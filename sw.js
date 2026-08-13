const SW_VER = 'v13';
const STATIC_CACHE  = `miyagi-static-${SW_VER}`;
const DATA_CACHE    = `miyagi-data-${SW_VER}`;
const TILE_CACHE    = `miyagi-tiles-${SW_VER}`;

/* 起動時にキャッシュするローカルファイル */
const STATIC_PRECACHE = [
  './',
  './index.html',
  './main.js',
  './style.css',
  './weather.js',
  './excel.js',
  './manifest.json',
  './icon.svg',
];

const DATA_PRECACHE = [
  './data/調査範囲.geojson',
  './data/計画路網.geojson',
  './data/小林班.pmtiles',
  './data/林班.pmtiles',
  './data/準林班.pmtiles',
];

/* ─── Install ─── */
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_PRECACHE)),
      caches.open(DATA_CACHE).then(c =>
        Promise.allSettled(DATA_PRECACHE.map(url => c.add(url)))
      ),
    ]).then(() => self.skipWaiting())
  );
});

/* ─── Activate ─── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('miyagi-') && !k.endsWith(SW_VER))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ─── Fetch ─── */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // GET のみ処理
  if (req.method !== 'GET') return;

  // PMTiles: Range リクエスト対応
  if (url.pathname.endsWith('.pmtiles')) {
    event.respondWith(handlePMTiles(req));
    return;
  }

  // GeoJSON: Cache First
  if (url.pathname.endsWith('.geojson')) {
    event.respondWith(cacheFirst(req, DATA_CACHE));
    return;
  }

  // 地理院タイル・OSM タイル: Cache First（オフライン時に既閲覧タイルを提供）
  if (
    url.hostname.includes('gsi.go.jp') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('tile.openstreetmap')
  ) {
    event.respondWith(cacheFirst(req, TILE_CACHE));
    return;
  }

  // CDN ライブラリ (Leaflet, protomaps, SheetJS): Cache First
  if (
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('sheetjs.com')
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // ローカルファイル: Network First（更新を優先、オフライン時はキャッシュ）
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, STATIC_CACHE));
    return;
  }
});

/* ─── Cache First ─── */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response.ok) cache.put(req, response.clone());
    return response;
  } catch (_) {
    return new Response('Offline', { status: 503 });
  }
}

/* ─── Network First ─── */
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(req);
    if (response.ok) cache.put(req, response.clone());
    return response;
  } catch (_) {
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || new Response('Offline', { status: 503 });
  }
}

/* ─── PMTiles: フルファイルをキャッシュし Range スライスで返す ─── */
async function handlePMTiles(req) {
  const url   = new URL(req.url);
  const key   = url.origin + url.pathname; // クエリなしのキー
  const cache = await caches.open(DATA_CACHE);
  const range = req.headers.get('Range');

  // フルファイルがキャッシュ済みか確認
  let full = await cache.match(new Request(key));

  if (!full) {
    try {
      const fetched = await fetch(new Request(key));
      if (!fetched.ok) return fetched;
      await cache.put(new Request(key), fetched.clone());
      full = fetched;
    } catch (_) {
      return new Response('PMTiles: offline & not cached', { status: 503 });
    }
  }

  if (!range) return full.clone();
  return sliceResponse(full, range);
}

/* ─── Range ヘッダーに応じてレスポンスをスライス ─── */
async function sliceResponse(response, rangeHeader) {
  const buf   = await response.clone().arrayBuffer();
  const total = buf.byteLength;
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return response.clone();

  const start = parseInt(match[1], 10);
  const end   = match[2] !== '' ? parseInt(match[2], 10) : total - 1;
  const slice = buf.slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Range':  `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
      'Content-Type':   'application/octet-stream',
      'Accept-Ranges':  'bytes',
    },
  });
}
