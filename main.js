const APP_VER = 'js-v42';
const fallbackLocation = [38.2688, 140.8721]; // 仙台市（宮城県庁）
const fallbackZoom = 10;
const currentLocationZoom = 15;
const _isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const gsiAttribution =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>';

const map = L.map("map", { zoomControl: true, maxZoom: 22 }).setView(fallbackLocation, fallbackZoom);

/* ─── カスタムペイン ─── */
map.createPane('rinpanPane');
map.getPane('rinpanPane').style.zIndex = 401;   // 林班（最下層）
map.createPane('junrinpanPane');
map.getPane('junrinpanPane').style.zIndex = 402; // 準林班
map.createPane('kobandanPane');
map.getPane('kobandanPane').style.zIndex = 403;  // 林小班
map.createPane('chosaPane');
map.getPane('chosaPane').style.zIndex = 420;     // 調査範囲
map.createPane('roadsPane');
map.getPane('roadsPane').style.zIndex = 450;     // 計画路網
map.createPane('gpxPane');
map.getPane('gpxPane').style.zIndex = 460;       // GPXトラック（最上層）

/* ─── ベースレイヤ（全て地図に追加、不要なものは opacity=0）─── */
const gsiStandard = L.tileLayer(
  "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  { attribution: gsiAttribution, maxNativeZoom: 18, maxZoom: 22, className: "grayscale-layer bm-multiply" }
);
const gsiAirPhoto = L.tileLayer(
  "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  { attribution: gsiAttribution, maxNativeZoom: 18, maxZoom: 22, className: "bm-multiply" }
);
const gsiRelief = L.tileLayer(
  "https://mygstrg.blob.core.windows.net/map/CSM/{z}/{x}/{y}.png",
  { attribution: '© 宮城県', maxNativeZoom: 17, maxZoom: 22, className: "bm-multiply", opacity: 0.7 }
);
gsiStandard.addTo(map);
gsiAirPhoto.addTo(map); gsiAirPhoto.setOpacity(0);
gsiRelief.addTo(map);   gsiRelief.setOpacity(0);

/* ─── 林種の色定義 ─── */
const LINSHU_COLOR = {
  '人工林':   { fill: 'rgba(100,180,220,0.45)', stroke: 'rgba(30,100,160,0.8)' },
  '天然林':   { fill: 'rgba(60,160,80,0.45)',   stroke: 'rgba(20,100,40,0.8)'  },
  '伐採跡地': { fill: 'rgba(210,160,80,0.55)',  stroke: 'rgba(160,100,20,0.8)' },
  '竹林':     { fill: 'rgba(160,200,100,0.5)',  stroke: 'rgba(80,140,20,0.8)'  },
  '未立木地': { fill: 'rgba(200,200,180,0.5)',  stroke: 'rgba(120,120,90,0.8)' },
};

/* ─── ヘルパー関数 ─── */
function fmtDate(v) {
  if (!v) return '―';
  return String(v).replace('T00:00:00', '');
}

function makeForestPopup(props) {
  const p = props;
  return `<div class="forest-popup">
    <div class="popup-title">🌲 林小班: ${p['小班'] || ''}</div>
    <table>
      <tr><th>林種</th><td>${p['林種'] || '―'}</td></tr>
      <tr><th>中樹種</th><td>${p['中樹種'] || '―'}</td></tr>
      <tr><th>林齢</th><td>${p['林齢'] != null ? p['林齢'] + '年' : '―'}</td></tr>
      <tr><th>齢級</th><td>${p['齢級'] != null ? p['齢級'] + '級' : '―'}</td></tr>
      <tr><th>小班面積</th><td>${p['小班面積'] != null ? p['小班面積'] + ' ha' : '―'}</td></tr>
      <tr><th>所有形態</th><td>${p['所有形態'] || '―'}</td></tr>
      <tr><th>KEY</th><td style="font-size:10px">${p['KEYCODE'] || '―'}</td></tr>
      <tr><th>登録日</th><td>${fmtDate(p['ADDDATE'])}</td></tr>
    </table>
  </div>`;
}

/* 各PMTilesレイヤのカスタムポップアップ（excel.jsから参照）*/
window.makeLayerPopup = function(name, props) {
  if (name === '林小班') return makeForestPopup(props);
  if (name === '林班')   return `<b>林班: ${props['RINPAN']}</b><br>${props['SICHOSON_N'] || ''}`;
  if (name === '準林班') return `<b>準林班: ${props['RINPAN']}${props['JUNRINPAN'] || ''}</b><br>${props['SICHOSON_N'] || ''}`;
  return null;
};

function toast(msg, ms = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.display = 'none'; }, ms);
}

/* ─── PMTilesレイヤ ─── */
const _kobandanPaintRules = [
  { dataLayer: 'kobandan', symbolizer: new protomapsL.PolygonSymbolizer({ fill: 'rgba(0,0,0,0)', stroke: '#ff0000', width: 1 }) },
];

const kobandanTiles = protomapsL.leafletLayer({
  url: 'data/林小班.pmtiles', maxDataZoom: 18,
  paintRules: _kobandanPaintRules, labelRules: [], pane: 'kobandanPane'
});
const rinpanTiles = protomapsL.leafletLayer({
  url: 'data/林班.pmtiles', maxDataZoom: 18,
  paintRules: [{ dataLayer: 'rinpan', symbolizer: new protomapsL.PolygonSymbolizer({ fill: 'rgba(0,0,0,0)', stroke: '#8d6ca2', width: 3 }) }],
  labelRules: [], pane: 'rinpanPane'
});
const junrinpanTiles = protomapsL.leafletLayer({
  url: 'data/準林班.pmtiles', maxDataZoom: 18,
  paintRules: [{ dataLayer: 'junrinpan', symbolizer: new protomapsL.PolygonSymbolizer({ fill: 'rgba(0,0,0,0)', stroke: '#49ce7f', width: 2 }) }],
  labelRules: [], pane: 'junrinpanPane'
});


/* Excel連携レイヤレジストリ（excel.jsから参照）*/
window.pmLayers = {
  '林小班': {
    layer: kobandanTiles, dataLayer: 'kobandan',
    keys: ['KEYCODE', '小班', '林種', '中樹種', '林齢', '齢級', '小班面積', '所有形態', 'ADDDATE']
  },
  '林班': {
    layer: rinpanTiles, dataLayer: 'rinpan',
    keys: ['RINPAN', 'SICHOSON_N', 'SICHOSON', 'ADDDATE']
  },
  '準林班': {
    layer: junrinpanTiles, dataLayer: 'junrinpan',
    keys: ['RINPAN', 'JUNRINPAN', 'SICHOSON_N', 'KEYCODE', 'ADDDATE']
  }
};

/* ─── GeoJSONレイヤ ─── */
const _geoLayers = {};
window.overlays = {};
let _loadCount = 0;
const _totalLayers = 2;

function _onLayerLoaded() {
  _loadCount++;
  if (_loadCount >= _totalLayers) {
    const el = document.getElementById('loadingIndicator');
    if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 400); }
    renderLayerControl();
  }
}

fetch('data/調査範囲.geojson')
  .then(r => r.json())
  .then(data => {
    _geoLayers['調査範囲'] = L.geoJSON(data, {
      style: { color: '#00aacc', weight: 4, fillOpacity: 0, dashArray: '6 4' },
      pane: 'chosaPane'
    });
    _onLayerLoaded();
  });

fetch('data/計画路網.geojson')
  .then(r => r.json())
  .then(data => {
    const _roadsOuter = L.geoJSON(data, {
      pane: 'roadsPane',
      style: { color: '#b8860b', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' },
      onEachFeature: (f, layer) => {
        layer.bindPopup(`<b>計画路網</b><br>ID: ${f.properties['id'] || '―'}`);
      }
    });
    const _roadsInner = L.geoJSON(data, {
      pane: 'roadsPane',
      style: { color: '#ffe000', weight: 2, opacity: 1, lineCap: 'round', lineJoin: 'round' },
      interactive: false
    });
    _geoLayers['計画路網'] = L.layerGroup([_roadsOuter, _roadsInner]);
    _onLayerLoaded();
  });

/* ─── レイヤコントロール ─── */
function renderLayerControl() {
  const mkLegend = (items) => {
    const rows = items.map(([color, label, type]) => {
      const cls  = type === 'line' ? 'lgnd-line' : 'lgnd-poly';
      const style = type === 'line'
        ? `background:${color}`
        : `background:${color};border:1px solid rgba(0,0,0,0.3)`;
      return `<span class="lgnd-row"><span class="lgnd-swatch ${cls}" style="${style}"></span>${label}</span>`;
    }).join('');
    return `<span class="layer-legend">${rows}</span>`;
  };

  const overlayMaps = {
    ['調査範囲' + mkLegend([['#00aacc', '境界', 'line']])]:
      _geoLayers['調査範囲'],
    ['林班' + mkLegend([['#8d6ca2', '林班境界', 'line']])]:
      rinpanTiles,
    ['準林班' + mkLegend([['#49ce7f', '準林班境界', 'line']])]:
      junrinpanTiles,
    ['林小班' + mkLegend([['#ff0000', '小班境界', 'line']])]:
      kobandanTiles,
    ['計画路網' + mkLegend([['#ffe000', '計画路網', 'line']])]:
      _geoLayers['計画路網'],
  };

  L.control.layers({}, overlayMaps, { position: 'topright', collapsed: false }).addTo(map);

  const panel      = document.querySelector('.leaflet-control-layers');
  const lcList     = panel.querySelector('.leaflet-control-layers-list');
  const overlaysDiv = panel.querySelector('.leaflet-control-layers-overlays');

  /* ── ✕ 閉じるボタン ── */
  const closeBtn = document.createElement('button');
  closeBtn.className = 'lc-close-btn'; closeBtn.textContent = '✕';
  panel.insertBefore(closeBtn, panel.firstChild);

  /* ── 「レイヤメニュー」開くボタン（body直下・fixed）── */
  const openBtn = document.createElement('button');
  openBtn.className = 'lc-open-btn'; openBtn.textContent = 'レイヤメニュー';
  document.body.appendChild(openBtn);

  function openPanel()  { panel.classList.remove('lc-hidden'); openBtn.style.display = 'none'; }
  function closePanel() { panel.classList.add('lc-hidden');    openBtn.style.display = 'block'; }
  L.DomEvent
    .on(closeBtn, 'mousedown dblclick touchstart', L.DomEvent.stopPropagation)
    .on(closeBtn, 'click', L.DomEvent.stop)
    .on(closeBtn, 'click', closePanel)
    .on(closeBtn, 'touchend', function(e) { L.DomEvent.stop(e); closePanel(); });
  openBtn.addEventListener('click', openPanel);
  openBtn.addEventListener('touchend', function(e) { e.preventDefault(); openPanel(); });

  /* ── ツールボックス ── */
  const tbDiv = document.createElement('div'); tbDiv.id = 'tbLayers';

  const curBtn = document.createElement('button');
  curBtn.className = 'tb-btn'; curBtn.id = 'btnCurrentLoc';
  curBtn.innerHTML = '<span class="ico">📍</span><span>現在地</span>';
  curBtn.addEventListener('click', function() {
    const btn = this;
    if (_follow) {
      _follow = false;
      btn.classList.remove('active');
      toast('現在地の追従を解除しました', 1500);
      return;
    }
    if (!navigator.geolocation) {
      toast('この端末では現在地を取得できません', 3000); return;
    }
    _follow = true;
    btn.classList.add('active');
    if (_gpsInitDone && _lastKnownPos) {
      const latlng = [_lastKnownPos.coords.latitude, _lastKnownPos.coords.longitude];
      _lastProgrammaticPan = Date.now();
      map.setView(latlng, Math.max(map.getZoom(), currentLocationZoom), { animate: true });
      return;
    }
    btn.classList.add('loading');
    _startGPS();
  });

  const xlsxBtn = document.createElement('button');
  xlsxBtn.className = 'tb-btn'; xlsxBtn.id = 'btnExcelLink';
  xlsxBtn.innerHTML = '<span class="ico">📊</span><span>Excel連携</span>';
  xlsxBtn.addEventListener('click', () => { if (window.xlsxOpenFile) window.xlsxOpenFile(); });

  tbDiv.appendChild(curBtn);
  lcList.insertBefore(tbDiv, lcList.firstChild);

  /* Excel連携は気象レイヤの後（MutationObserverで検出してから追加）*/
  const xlsxObserver = new MutationObserver(() => {
    if (!document.getElementById('wxLayerLabel')) return;
    xlsxObserver.disconnect();
    const xlsxSep = document.createElement('div');
    xlsxSep.className = 'leaflet-control-layers-separator';
    overlaysDiv.appendChild(xlsxSep);
    const xlsxWrap = document.createElement('div');
    xlsxWrap.style.padding = '2px 0 4px';
    xlsxWrap.appendChild(xlsxBtn);
    overlaysDiv.appendChild(xlsxWrap);
  });
  xlsxObserver.observe(overlaysDiv, { childList: true });

  /* ── ベースマップ セクション ── */
  const bmSep = document.createElement('div'); bmSep.className = 'leaflet-control-layers-separator';
  const bmLbl = document.createElement('div'); bmLbl.className = 'lc-section-label'; bmLbl.textContent = 'ベースマップ';
  lcList.insertBefore(bmSep, tbDiv.nextSibling);
  lcList.insertBefore(bmLbl, bmSep.nextSibling);

  const bmContainer = document.createElement('div');
  [
    { id: 'bmStd', label: '地理院標準地図', layer: gsiStandard, defVal: 1.0 },
    { id: 'bmAir', label: '航空写真',       layer: gsiAirPhoto, defVal: 0.0 },
    { id: 'bmRlf', label: 'CS立体図',       layer: gsiRelief,   defVal: 0.0 },
  ].forEach(def => {
    const item   = document.createElement('div'); item.className = 'bm-item';
    const row    = document.createElement('div'); row.className  = 'bm-row';
    const chk    = document.createElement('input'); chk.type = 'checkbox'; chk.id = def.id; chk.checked = def.defVal > 0;
    const lbl    = document.createElement('label'); lbl.setAttribute('for', def.id); lbl.textContent = def.label;
    const pct    = document.createElement('span'); pct.className = 'bm-pct'; pct.id = def.id + 'Pct'; pct.textContent = Math.round(def.defVal * 100) + '%';
    const slider = document.createElement('input'); slider.type = 'range'; slider.className = 'bm-slider';
    slider.min = 0; slider.max = 1; slider.step = 0.05; slider.value = def.defVal;
    if (def.defVal === 0) { slider.disabled = true; slider.style.opacity = '0.4'; }
    row.append(chk, lbl, pct); item.append(row, slider); bmContainer.appendChild(item);

    function applyBm(val) {
      def.layer.setOpacity(val);
      pct.textContent = Math.round(val * 100) + '%';
      chk.checked = val > 0; slider.value = val;
      slider.disabled = val === 0; slider.style.opacity = val === 0 ? '0.4' : '1';
    }
    chk.addEventListener('change', function() { applyBm(this.checked ? (parseFloat(slider.value) || 1.0) : 0); });
    slider.addEventListener('input', function() { applyBm(parseFloat(this.value)); });
  });
  lcList.insertBefore(bmContainer, bmLbl.nextSibling);

  /* ── オーバーレイ セクションラベル ── */
  const ovLbl = document.createElement('div'); ovLbl.className = 'lc-section-label'; ovLbl.textContent = '森林レイヤ';
  overlaysDiv.insertBefore(ovLbl, overlaysDiv.firstChild);

  if (window.innerWidth < 768) closePanel();
}

/* ─── GeoTIFF読込 ─── */
let _geotiffLayer = null;
let _geotiffPaneName = null;
let _geotiffSeq = 0;

function _nukeGeotiffLayers() {
  /* 旧ペインを即座に非表示にして3秒後に削除（GPU残像対策） */
  if (_geotiffPaneName) {
    const old = map.getPane(_geotiffPaneName);
    if (old) {
      old.style.display = 'none';
      const snap = old;
      setTimeout(() => { try { snap.remove(); } catch (_) {} }, 3000);
    }
    _geotiffPaneName = null;
  }
  /* 旧レイヤーをマップから除去 */
  if (_geotiffLayer) {
    try { map.removeLayer(_geotiffLayer); } catch (_) {}
    _geotiffLayer = null;
  }
}

async function _loadGeoTIFF(file) {
  if (!file) return;
  const seq = ++_geotiffSeq;
  _nukeGeotiffLayers();
  _showGeotiffCard('\u{1F504} 読み込み中...');
  try {
    const buf = await file.arrayBuffer();
    if (seq !== _geotiffSeq) return;
    const georaster = await parseGeoraster(buf);
    if (seq !== _geotiffSeq) return;
    /* 毎回ユニークなペイン名を生成（旧ペインとの混在を完全排除） */
    const paneName = `gtPane_${seq}`;
    map.createPane(paneName).style.zIndex = '250';
    _geotiffPaneName = paneName;
    _geotiffLayer = new GeoRasterLayer({ georaster, opacity: 0.75, resolution: 256, pane: paneName });
    _geotiffLayer.addTo(map);
    map.fitBounds(_geotiffLayer.getBounds());
    _showGeotiffCard(file.name);
    toast('GeoTIFF読み込み完了', 2000);
  } catch (err) {
    if (seq !== _geotiffSeq) return;
    const card = document.getElementById('geotiffCard');
    if (card) card.remove();
    toast('GeoTIFFの読み込みに失敗しました', 2500);
    console.error(err);
  }
}

function _showGeotiffCard(name) {
  let card = document.getElementById('geotiffCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'geotiffCard';
    document.body.appendChild(card);
  }
  clearTimeout(card._miniTimer);

  const short = name.length > 24 ? name.slice(0, 21) + '...' : name;

  const doRemove = () => {
    _nukeGeotiffLayers();
    card.remove();
  };

  const showFull = () => {
    clearTimeout(card._miniTimer);
    card.classList.remove('geotiff-card-mini');
    card.onclick = null;
    card.innerHTML = `<span>🗺 ${short}</span><button id="geotiffCardClose">✕ 解除</button>`;
    document.getElementById('geotiffCardClose').onclick = doRemove;
    card._miniTimer = setTimeout(() => {
      card.classList.add('geotiff-card-mini');
      card.textContent = '🗺';
      card.onclick = showFull;
    }, 5000);
  };

  showFull();
}

/* ─── GeoJSON / GeoPackage 読込 ─── */
let _vectorDropLayer = null;

function _loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function _renderVectorLayer(geojson, filename) {
  if (_vectorDropLayer) { map.removeLayer(_vectorDropLayer); }
  _vectorDropLayer = L.geoJSON(geojson, {
    style: { color: '#9c27b0', weight: 2, fillOpacity: 0.15, opacity: 0.9 },
    pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5, color: '#9c27b0', fillOpacity: 0.8 }),
    onEachFeature: (f, layer) => {
      if (!f.properties) return;
      const rows = Object.entries(f.properties)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
      if (rows) layer.bindPopup(`<table class="forest-popup">${rows}</table>`);
    }
  }).addTo(map);
  const bounds = _vectorDropLayer.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  _showVectorCard(filename);
}

function _showVectorCard(name) {
  let card = document.getElementById('vectorDropCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'vectorDropCard';
    document.body.appendChild(card);
  }
  const short = name.length > 24 ? name.slice(0, 21) + '...' : name;
  card.innerHTML = `<span>📋 ${short}</span><button id="vectorDropClose">✕ 解除</button>`;
  document.getElementById('vectorDropClose').onclick = () => {
    if (_vectorDropLayer) { map.removeLayer(_vectorDropLayer); _vectorDropLayer = null; }
    card.remove();
  };
}

async function _loadGeoJSON(file) {
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    /* FeatureCollection に正規化 */
    let fc = raw.type === 'FeatureCollection' ? raw
           : raw.type === 'Feature' ? { type: 'FeatureCollection', features: [raw] }
           : { type: 'FeatureCollection', features: [] };

    /* crs プロパティから EPSG コードを取得 */
    let epsgId = null;
    const crsName = raw.crs?.properties?.name || '';
    const m = crsName.match(/EPSG[::]+(\d+)/i);
    if (m) epsgId = parseInt(m[1]);

    /* 座標が地理座標系の範囲外なら再投影 */
    if (fc.features.length > 0) {
      let tc = fc.features[0].geometry?.coordinates;
      if (tc) {
        while (Array.isArray(tc[0])) tc = tc[0];
        if (Math.abs(tc[0]) > 180 || Math.abs(tc[1]) > 90) {
          toast('座標系を判定中...', 5000);
          const result = await _resolveJpPlaneTransform(tc, epsgId);
          if (!result) {
            toast('⚠ 座標系を判別できません。WGS84 に変換してから読み込んでください。', 6000);
            return;
          }
          fc.features = fc.features.map(f =>
            f.geometry ? { ...f, geometry: _applyCoordTransform(f.geometry, result.fn) } : f
          );
          toast(`GeoJSON読み込み完了（${fc.features.length}件, EPSG:${result.epsgId}→WGS84）`, 2500);
          _renderVectorLayer(fc, file.name);
          return;
        }
      }
    }
    _renderVectorLayer(fc, file.name);
    toast(`GeoJSON読み込み完了（${fc.features.length}件）`, 2000);
  } catch (e) {
    toast('GeoJSONの読み込みに失敗しました', 2500);
    console.error(e);
  }
}

/* 日本平面直角座標系 EPSG → [中央経線, 原点緯度] */
const _JP_PLANE = {
  6669:[129.5,33],  6670:[131,33],          6671:[132+10/60,36],
  6672:[133.5,33],  6673:[134+20/60,36],    6674:[136,36],
  6675:[137+10/60,36], 6676:[138.5,36],     6677:[139+50/60,36],
  6678:[140+50/60,40], 6679:[140.25,44],    6680:[142.25,44],
  6681:[144.25,44], 6682:[142,26],
  2443:[129.5,33],  2444:[131,33],          2445:[132+10/60,36],
  2446:[133.5,33],  2447:[134+20/60,36],    2448:[136,36],
  2449:[137+10/60,36], 2450:[138.5,36],     2451:[139+50/60,36],
  2452:[140+50/60,40], 2453:[140.25,44],    2454:[142.25,44],
  2455:[144.25,44], 2456:[142,26],
};

function _applyCoordTransform(geom, fn) {
  const t = coords => typeof coords[0] === 'number' ? fn(coords) : coords.map(t);
  return { ...geom, coordinates: t(geom.coordinates) };
}

/* 日本平面直角座標系→WGS84 変換関数を返す（ゾーン自動判定対応） */
async function _resolveJpPlaneTransform(testCoord, epsgId) {
  if (!window.proj4) {
    await _loadScript('https://unpkg.com/proj4@2.9.0/dist/proj4.js');
  }
  const inJapan = lon => lon > 120 && lon < 155;
  const makeFn = (zone, swap) => {
    const pstr = `+proj=tmerc +lat_0=${zone[1]} +lon_0=${zone[0]} +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs`;
    const proj = c => proj4(pstr, '+proj=longlat +datum=WGS84').forward(c);
    return swap ? c => proj([c[1], c[0]]) : c => proj([c[0], c[1]]);
  };
  const tryZone = (id) => {
    const zone = _JP_PLANE[id]; if (!zone) return null;
    const pstr = `+proj=tmerc +lat_0=${zone[1]} +lon_0=${zone[0]} +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs`;
    const proj = c => proj4(pstr, '+proj=longlat +datum=WGS84').forward(c);
    const t1 = proj([testCoord[0], testCoord[1]]);
    if (inJapan(t1[0])) return { fn: makeFn(zone, false), epsgId: id };
    const t2 = proj([testCoord[1], testCoord[0]]);
    if (inJapan(t2[0])) return { fn: makeFn(zone, true), epsgId: id };
    return null;
  };
  if (epsgId) { const r = tryZone(epsgId); if (r) return r; }
  for (const id of Object.keys(_JP_PLANE)) { const r = tryZone(id); if (r) return r; }
  return null;
}

async function _loadGPKG(file) {
  if (!file) return;
  toast('GeoPackage読み込み中...', 10000);
  try {
    if (!window.initSqlJs) {
      await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js');
    }
    if (!window._sqlJs) {
      window._sqlJs = await window.initSqlJs({
        locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
      });
    }
    const db = new window._sqlJs.Database(new Uint8Array(await file.arrayBuffer()));

    let gcRes;
    try { gcRes = db.exec('SELECT table_name, column_name, srs_id FROM gpkg_geometry_columns'); }
    catch(e) { toast('GeoPackage形式が不正です', 2500); db.close(); return; }

    if (!gcRes.length || !gcRes[0].values.length) {
      toast('フィーチャレイヤが見つかりません', 2500); db.close(); return;
    }

    const features = [];
    for (const [tbl, geomCol, srsId] of gcRes[0].values) {
      const res = db.exec(`SELECT * FROM "${tbl}"`);
      if (!res.length) continue;
      const cols = res[0].columns;
      const gi = cols.indexOf(geomCol);
      for (const row of res[0].values) {
        if (!row[gi]) continue;
        try {
          const bytes = row[gi] instanceof Uint8Array ? row[gi] : new Uint8Array(row[gi]);
          const geom = _gpkgGeomToGeoJSON(bytes);
          if (!geom) continue;
          const props = { _srs_id: srsId };
          cols.forEach((c, i) => { if (i !== gi) props[c] = row[i]; });
          features.push({ type: 'Feature', geometry: geom, properties: props });
        } catch(e) { /* skip */ }
      }
    }
    db.close();
    if (!features.length) { toast('ジオメトリが見つかりません', 2500); return; }

    /* 座標が度の範囲外 → 平面直角座標系とみなして再投影を試みる */
    let testCoord = features[0].geometry.coordinates;
    while (Array.isArray(testCoord[0])) testCoord = testCoord[0];
    const isProjected = Math.abs(testCoord[0]) > 180 || Math.abs(testCoord[1]) > 90;

    if (isProjected) {
      const srsId = gcRes[0].values[0][2];
      const result = await _resolveJpPlaneTransform(testCoord, srsId);
      if (!result) {
        toast(`⚠ 座標系(EPSG:${srsId})に対応していません。WGS84/JGD2011に変換してください。`, 6000);
        return;
      }
      for (let f of features) {
        f.geometry = _applyCoordTransform(f.geometry, result.fn);
      }
      toast(`GeoPackage読み込み完了（${features.length}件, EPSG:${result.epsgId}→WGS84）`, 2500);
    } else {
      toast(`GeoPackage読み込み完了（${features.length}件）`, 2000);
    }

    _renderVectorLayer({ type: 'FeatureCollection', features }, file.name);
  } catch (e) {
    toast('GeoPackageの読み込みに失敗しました', 2500);
    console.error(e);
  }
}

/* GeoPackage バイナリジオメトリ → GeoJSON geometry */
function _gpkgGeomToGeoJSON(bytes) {
  if (bytes[0] !== 0x47 || bytes[1] !== 0x50) return null; // 'GP' magic
  const flags = bytes[3];
  if ((flags >> 4) & 1) return null; // empty geometry
  const envSizes = [0, 32, 48, 48, 64];
  const wkbOff = 8 + (envSizes[(flags >> 1) & 7] || 0);
  const dv = new DataView(bytes.buffer, bytes.byteOffset + wkbOff);
  return _wkbParse(dv, { o: 0 }).geom;
}

function _wkbParse(dv, s) {
  const le = dv.getUint8(s.o) === 1; s.o++;
  const tc = le ? dv.getUint32(s.o, true) : dv.getUint32(s.o, false); s.o += 4;
  if (tc & 0x20000000) s.o += 4; // skip embedded SRID

  const raw = tc & 0xFFFF;
  let bt = raw > 3000 ? raw - 3000 : raw > 2000 ? raw - 2000 : raw > 1000 ? raw - 1000 : raw;
  const nd = raw > 3000 ? 4 : (raw > 1000 || (tc & 0x80000000) || (tc & 0x40000000)) ? 3 : 2;
  const st = nd * 8;

  const rf = o => le ? dv.getFloat64(o, true) : dv.getFloat64(o, false);
  const ri = o => le ? dv.getUint32(o, true) : dv.getUint32(o, false);
  const rPt  = () => { const p = [rf(s.o), rf(s.o + 8)]; s.o += st; return p; };
  const rPts = () => { const n = ri(s.o); s.o += 4; const a = []; for(let i=0;i<n;i++) a.push(rPt()); return a; };

  switch (bt) {
    case 1: return { geom: { type: 'Point', coordinates: rPt() } };
    case 2: return { geom: { type: 'LineString', coordinates: rPts() } };
    case 3: {
      const n = ri(s.o); s.o += 4;
      const rings = []; for(let i=0;i<n;i++) rings.push(rPts());
      return { geom: { type: 'Polygon', coordinates: rings } };
    }
    case 4: {
      const n = ri(s.o); s.o += 4;
      const pts = []; for(let i=0;i<n;i++) pts.push(_wkbParse(dv,s).geom.coordinates);
      return { geom: { type: 'MultiPoint', coordinates: pts } };
    }
    case 5: {
      const n = ri(s.o); s.o += 4;
      const ls = []; for(let i=0;i<n;i++) ls.push(_wkbParse(dv,s).geom.coordinates);
      return { geom: { type: 'MultiLineString', coordinates: ls } };
    }
    case 6: {
      const n = ri(s.o); s.o += 4;
      const ps = []; for(let i=0;i<n;i++) ps.push(_wkbParse(dv,s).geom.coordinates);
      return { geom: { type: 'MultiPolygon', coordinates: ps } };
    }
    default: return { geom: null };
  }
}

/* ─── GPSログ・GPXインポート ─── */
let _trackSegments = [], _trackLines = [], _trackActive = false, _importedTrackLine = null;
let currentLocationMarker = null, currentLocationCircle = null, _lastKnownPos = null;
let _watchId = null, _follow = false, _gpsInitDone = false, _lastProgrammaticPan = 0;
let _lastTrackPoint = null; // 速度チェック用（直前の記録点）

const GPS_MAX_LOG_ACCURACY = 50; // m: これ以上精度が悪い点は記録しない
const GPS_MAX_JUMP_SPEED   = 50; // m/s: これ以上の移動速度は飛びと判定（=180km/h）

function _latLngDistM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const dφ = (lat2 - lat1) * Math.PI / 180, dλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── ウェイポイント・調査セッション ─── */
let _waypoints = [];       // [{lat, lng, comment, ts, marker}]
let _surveyId = null;      // IndexedDB のID（null = 未保存）
let _surveyName = '';      // 調査名
let _surveyFolderId = null; // 調査の所属フォルダID
let _surveyStartedAt = null;
let _autoSaveTimer = null;

/* IndexedDB ラッパー */
const _IDB_NAME = 'miyagi-surveys', _IDB_STORE = 'surveys', _IDB_FOLDER_STORE = 'folders';
let _idb = null;

function _openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_IDB_STORE))
        db.createObjectStore(_IDB_STORE, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(_IDB_FOLDER_STORE))
        db.createObjectStore(_IDB_FOLDER_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbPut(obj) {
  const db = await _openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_STORE, 'readwrite');
    const req = obj.id != null ? tx.objectStore(_IDB_STORE).put(obj) : tx.objectStore(_IDB_STORE).add(obj);
    req.onsuccess = e => { obj.id = e.target.result; resolve(obj); };
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbGetAll() {
  const db = await _openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(_IDB_STORE, 'readonly').objectStore(_IDB_STORE).getAll();
    req.onsuccess = e => resolve([...e.target.result].reverse());
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbDelete(id) {
  const db = await _openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(_IDB_STORE, 'readwrite').objectStore(_IDB_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbPutFolder(obj) {
  const db = await _openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_FOLDER_STORE, 'readwrite');
    const req = obj.id != null ? tx.objectStore(_IDB_FOLDER_STORE).put(obj) : tx.objectStore(_IDB_FOLDER_STORE).add(obj);
    req.onsuccess = e => { obj.id = e.target.result; resolve(obj); };
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbGetAllFolders() {
  const db = await _openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(_IDB_FOLDER_STORE, 'readonly').objectStore(_IDB_FOLDER_STORE).getAll();
    req.onsuccess = e => resolve([...e.target.result]);
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbDeleteFolder(id) {
  const db = await _openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(_IDB_FOLDER_STORE, 'readwrite').objectStore(_IDB_FOLDER_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbOrphanSurveys(folderId) {
  const db = await _openIDB();
  const surveys = await _idbGetAll();
  const toUpdate = surveys.filter(s => s.folderId === folderId);
  if (!toUpdate.length) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_IDB_STORE, 'readwrite');
    const store = tx.objectStore(_IDB_STORE);
    for (const s of toUpdate) { s.folderId = null; store.put(s); }
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}

/* 自動保存（debounce 500ms） */
function _autoSaveSurvey() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(async () => {
    if (!_surveyName && !_totalPoints() && !_waypoints.length) return;
    try {
      const survey = {
        id: _surveyId ?? undefined,
        name: _surveyName || new Date().toLocaleString('ja-JP'),
        folderId: _surveyFolderId ?? null,
        startedAt: _surveyStartedAt || new Date().toISOString(),
        savedAt: new Date().toISOString(),
        segments: _trackSegments.map(s => s.map(p => ({ lat: p.lat, lng: p.lng, ts: p.ts }))),
        waypoints: _waypoints.map(w => ({ lat: w.lat, lng: w.lng, comment: w.comment, ts: w.ts, photoData: w.photoData || null })),
      };
      const saved = await _idbPut(survey);
      _surveyId = saved.id;
    } catch (e) { console.error('自動保存失敗:', e); }
  }, 500);
}

/* 画像を最大1200pxにリサイズしてJPEG base64で返す */
function _compressImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* ウェイポイント追加 */
function _addWaypoint(latlng, comment, photoData = null) {
  const ts = new Date().toISOString();
  const hasPhoto = !!photoData;
  const marker = L.circleMarker([latlng.lat, latlng.lng], {
    radius: 9,
    color:       hasPhoto ? '#1565c0' : '#e65100',
    fillColor:   hasPhoto ? '#42a5f5' : '#ff9800',
    fillOpacity: 0.95, weight: 2, pane: 'gpxPane'
  }).addTo(map);
  let popup = comment ? `<b>${hasPhoto ? '📷' : '📍'} ${comment}</b>` : (hasPhoto ? '<b>📷 写真</b>' : '');
  if (hasPhoto) popup += `<br><img src="${photoData}" style="max-width:220px;border-radius:6px;margin-top:5px;display:block">`;
  if (popup) marker.bindPopup(popup);
  _waypoints.push({ lat: latlng.lat, lng: latlng.lng, comment, ts, photoData, marker });
  _autoSaveSurvey();
}
function _clearWaypoints() {
  _waypoints.forEach(w => { try { map.removeLayer(w.marker); } catch (_) {} });
  _waypoints = [];
}

/* ウェイポイントダイアログ
 * initialPhoto: カメラボタンから呼ばれた場合は写真データを最初から渡す */
function _showWaypointDialog(latlng, initialPhoto = null) {
  let photoData = initialPhoto;

  const titleIcon = photoData ? '📷' : '📍';
  const titleText = photoData ? '写真ポイントを追加' : 'ポイントを追加';

  const ov = document.createElement('div');
  ov.className = 'survey-overlay';
  ov.innerHTML = `<div class="survey-dialog">
    <div class="survey-dialog-title">${titleIcon} ${titleText}</div>
    <input id="wptInput" type="text" placeholder="コメント（任意）" maxlength="80">
    <div id="wptPhotoWrap" style="${photoData ? '' : 'display:none;'}margin-top:6px">
      <img id="wptPhotoImg" style="max-width:100%;border-radius:8px;display:block" ${photoData ? `src="${photoData}"` : ''}>
      <button id="wptPhotoRemove" class="survey-hbtn survey-del" style="margin-top:5px;font-size:11px">✕ 写真を削除</button>
    </div>
    <div class="survey-dialog-btns">
      <button id="wptCancel">キャンセル</button>
      <button id="wptOk" class="survey-ok">追加</button>
    </div>
  </div>`;
  document.body.appendChild(ov);

  const inp  = ov.querySelector('#wptInput');
  const wrap = ov.querySelector('#wptPhotoWrap');

  setTimeout(() => inp.focus(), 80);

  ov.querySelector('#wptPhotoRemove').onclick = () => {
    photoData = null;
    wrap.style.display = 'none';
  };

  const doAdd = () => { const c = inp.value.trim(); ov.remove(); _addWaypoint(latlng, c, photoData); };
  ov.querySelector('#wptOk').onclick = doAdd;
  ov.querySelector('#wptCancel').onclick = () => ov.remove();
  inp.onkeydown = e => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') ov.remove(); };
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}


/* 調査管理モーダル（フォルダ + 名前設定 + 履歴） */
async function _showSurveyManager() {
  let surveys, folders;
  try {
    [surveys, folders] = await Promise.all([_idbGetAll(), _idbGetAllFolders()]);
  } catch (_) { toast('履歴の読み込みに失敗しました', 2000); return; }

  const ov = document.createElement('div');
  ov.className = 'survey-overlay';
  document.body.appendChild(ov);

  const hasCurrent = _totalPoints() > 0 || _waypoints.length > 0;

  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const renderSurveyRow = s => {
    const pts = s.segments.reduce((n, sg) => n + sg.length, 0);
    const d   = new Date(s.startedAt).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
    return `<div class="survey-row">
      <div class="survey-row-info"><b>${esc(s.name)}</b><span>${d} ｜ ${pts}pt ${s.waypoints.length}wpt</span></div>
      <div class="survey-row-btns">
        <button class="survey-hbtn" data-id="${s.id}" data-action="load">🗺 表示</button>
        <button class="survey-hbtn" data-id="${s.id}" data-action="gpx">💾 GPX</button>
        <button class="survey-hbtn survey-del" data-id="${s.id}" data-action="del">🗑</button>
      </div>
    </div>`;
  };

  const renderGrouped = () => {
    let html = '';
    for (const folder of folders) {
      const fs = surveys.filter(s => s.folderId === folder.id);
      html += `<div class="survey-folder-header">
        <span>📁 ${esc(folder.name)}</span>
        <div class="survey-folder-actions">
          ${fs.length ? `<button class="survey-hbtn" data-folder-id="${folder.id}" data-action="folder-zip">📥 ZIPダウンロード</button>` : ''}
          <button class="survey-hbtn survey-del" data-folder-id="${folder.id}" data-action="folder-del">🗑 削除</button>
        </div>
      </div>`;
      html += fs.length ? fs.map(renderSurveyRow).join('') : '<div class="survey-empty-folder">（調査なし）</div>';
    }
    const unclassified = surveys.filter(s => !s.folderId);
    if (unclassified.length) {
      html += `<div class="survey-folder-header"><span>📁 未分類</span></div>`;
      html += unclassified.map(renderSurveyRow).join('');
    }
    if (!html) html = '<div class="survey-empty">保存された調査はありません</div>';
    return html;
  };

  const folderOptions = () => folders.map(f =>
    `<option value="${f.id}" ${_surveyFolderId === f.id ? 'selected' : ''}>${esc(f.name)}</option>`
  ).join('');

  const buildContent = () => {
    const curHtml = hasCurrent ? `
      <div class="survey-section-title">現在の調査</div>
      <div class="survey-cur-row">
        <input id="surveyNameInp" type="text" placeholder="調査名（未設定）" maxlength="40" value="${esc(_surveyName)}">
      </div>
      <div class="survey-cur-row">
        <select id="surveyFolderSel" class="survey-folder-sel">
          <option value="">── 未分類 ──</option>
          ${folderOptions()}
        </select>
        <button id="surveyNameSave" class="survey-ok survey-hbtn">保存</button>
      </div>` : '';
    return `<div class="survey-history-box">
      <div class="survey-history-title">🗂 調査管理</div>
      <button id="newFolderBtn" class="survey-hbtn survey-new-folder-btn">📁 新しいフォルダを作成</button>
      ${curHtml}
      <div class="survey-section-title" style="margin-top:6px">調査履歴</div>
      <div id="surveyGroupedList" class="survey-history-list">${renderGrouped()}</div>
      <button id="surveyManagerClose" class="survey-hbtn" style="margin-top:6px">閉じる</button>
    </div>`;
  };

  const refresh = () => { ov.innerHTML = buildContent(); bindEvents(); };
  refresh();

  function bindEvents() {
    ov.querySelector('#surveyManagerClose').onclick = () => ov.remove();
    ov.onclick = e => { if (e.target === ov) ov.remove(); };

    ov.querySelector('#newFolderBtn').onclick = () => {
      const btn = ov.querySelector('#newFolderBtn');
      const row = document.createElement('div');
      row.className = 'survey-cur-row';
      row.innerHTML = `<input id="newFolderInp" type="text" placeholder="フォルダ名を入力" maxlength="40" style="flex:1">
        <button id="newFolderCancel" class="survey-hbtn">✕</button>
        <button id="newFolderOk" class="survey-ok survey-hbtn">作成</button>`;
      btn.replaceWith(row);
      const inp = row.querySelector('#newFolderInp');
      setTimeout(() => inp.focus(), 50);
      const doCreate = async () => {
        const name = inp.value.trim();
        if (!name) { inp.focus(); return; }
        const folder = await _idbPutFolder({ name, createdAt: new Date().toISOString() });
        folders.push(folder);
        refresh();
      };
      row.querySelector('#newFolderOk').onclick = doCreate;
      row.querySelector('#newFolderCancel').onclick = refresh;
      inp.onkeydown = e => { if (e.key === 'Enter') doCreate(); if (e.key === 'Escape') refresh(); };
    };

    if (hasCurrent) {
      ov.querySelector('#surveyNameSave').onclick = () => {
        const n = ov.querySelector('#surveyNameInp').value.trim();
        const fid = ov.querySelector('#surveyFolderSel').value;
        if (n) { _surveyName = n; if (!_surveyStartedAt) _surveyStartedAt = new Date().toISOString(); }
        _surveyFolderId = fid ? parseInt(fid) : null;
        _autoSaveSurvey();
        toast('調査を保存しました', 1500);
        ov.remove(); _buildTrackCtrl();
      };
    }

    ov.querySelector('#surveyGroupedList').addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'load') {
        const s = surveys.find(x => x.id === parseInt(btn.dataset.id));
        if (s) { ov.remove(); _loadSurveyOnMap(s); }

      } else if (action === 'gpx') {
        const s = surveys.find(x => x.id === parseInt(btn.dataset.id));
        if (s) _exportSurveyGPX(s);

      } else if (action === 'del') {
        const id = parseInt(btn.dataset.id);
        const s  = surveys.find(x => x.id === id);
        if (!s || !confirm(`「${s.name}」を削除しますか？`)) return;
        await _idbDelete(id);
        surveys = surveys.filter(x => x.id !== id);
        ov.querySelector('#surveyGroupedList').innerHTML = renderGrouped();

      } else if (action === 'folder-zip') {
        const fid = parseInt(btn.dataset.folderId);
        const fs  = surveys.filter(s => s.folderId === fid);
        const folder = folders.find(f => f.id === fid);
        _exportFolderZip(fs, folder?.name || 'フォルダ');

      } else if (action === 'folder-del') {
        const fid = parseInt(btn.dataset.folderId);
        const folder = folders.find(f => f.id === fid);
        const fSurveys = surveys.filter(s => s.folderId === fid);
        const msg = fSurveys.length
          ? `「${folder?.name}」フォルダを削除しますか？\n（調査${fSurveys.length}件は未分類に移動します）`
          : `「${folder?.name}」フォルダを削除しますか？`;
        if (!confirm(msg)) return;
        await _idbOrphanSurveys(fid);
        await _idbDeleteFolder(fid);
        surveys.forEach(s => { if (s.folderId === fid) s.folderId = null; });
        folders = folders.filter(f => f.id !== fid);
        if (_surveyFolderId === fid) _surveyFolderId = null;
        ov.querySelector('#surveyGroupedList').innerHTML = renderGrouped();
      }
    });
  }
}



/* 調査を地図に読み込み */
function _loadSurveyOnMap(survey) {
  _clearWaypoints();
  _trackLines.forEach(l => { try { map.removeLayer(l); } catch (_) {} });
  _trackLines = []; _trackSegments = [];
  _trackSegments = survey.segments.map(s => s.map(p => ({ lat: p.lat, lng: p.lng, ts: p.ts })));
  _trackSegments.forEach((seg, i) => {
    if (seg.length >= 2)
      _trackLines[i] = L.polyline(seg.map(p => [p.lat, p.lng]),
        { color: '#e53935', weight: 4, opacity: 0.85, pane: 'gpxPane' }).addTo(map);
  });
  survey.waypoints.forEach(w => _addWaypoint({ lat: w.lat, lng: w.lng }, w.comment, w.photoData || null));
  const allPts = _trackSegments.flat();
  if (allPts.length) map.fitBounds(L.latLngBounds(allPts.map(p => [p.lat, p.lng])), { padding: [20, 20] });
  _surveyId = survey.id; _surveyName = survey.name; _surveyFolderId = survey.folderId ?? null; _surveyStartedAt = survey.startedAt;
  toast(`「${survey.name}」を読み込みました`, 2000);
  _buildTrackCtrl();
}

/* GPX XML 生成（共通） waypoints に photoFile フィールドがあれば <link> を追加 */
function _buildGPX(survey) {
  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GeoForest Map" xmlns="http://www.topografix.com/GPX/1/1">\n`;
  for (const w of survey.waypoints) {
    xml += `  <wpt lat="${w.lat}" lon="${w.lng}">\n    <time>${w.ts}</time>\n`;
    if (w.comment) xml += `    <name>${esc(w.comment)}</name>\n    <cmt>${esc(w.comment)}</cmt>\n`;
    if (w.photoFile) xml += `    <link href="photos/${esc(w.photoFile)}"><text>${esc(w.comment || 'photo')}</text></link>\n`;
    xml += `  </wpt>\n`;
  }
  xml += `  <trk><name>${esc(survey.name)}</name>\n`;
  for (const seg of survey.segments) {
    if (!seg.length) continue;
    xml += `    <trkseg>\n`;
    for (const p of seg) xml += `      <trkpt lat="${p.lat}" lon="${p.lng}"><time>${p.ts}</time></trkpt>\n`;
    xml += `    </trkseg>\n`;
  }
  xml += `  </trk>\n</gpx>`;
  return xml;
}

/* 調査1件分のZIPコンテンツを準備（GPX + 写真リスト） */
function _buildSurveyZipContent(survey) {
  const photos = [];
  const waypoints = survey.waypoints.map((w, i) => {
    if (!w.photoData) return w;
    const safe = (w.comment || '').replace(/[^\w぀-鿿]/g, '_').slice(0, 20);
    const fname = `${String(i + 1).padStart(3, '0')}${safe ? '_' + safe : ''}.jpg`;
    photos.push({ fname, dataUrl: w.photoData });
    return { ...w, photoFile: fname };
  });
  return { gpxContent: _buildGPX({ ...survey, waypoints }), photos };
}

/* 個別 GPX 書き出し */
function _exportSurveyGPX(survey) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([_buildGPX(survey)], { type: 'application/gpx+xml' }));
  a.download = `${new Date(survey.startedAt).toISOString().slice(0,10)}_${survey.name.replace(/[^\w぀-鿿]/g,'_')}.gpx`;
  a.click();
}
function _exportCurrentGPX() {
  if (!_totalPoints() && !_waypoints.length) { toast('記録がありません', 1500); return; }
  _exportSurveyGPX({
    name: _surveyName || new Date().toLocaleString('ja-JP'),
    startedAt: _surveyStartedAt || new Date().toISOString(),
    segments: _trackSegments,
    waypoints: _waypoints,
  });
}

/* フォルダを ZIP でダウンロード（調査ごとサブフォルダ） */
async function _exportFolderZip(surveys, folderName) {
  if (!surveys.length) { toast('調査データがありません', 1500); return; }
  toast('ZIP 作成中...', 3000);
  try {
    const zip = new JSZip();
    for (const s of surveys) {
      const date = new Date(s.startedAt).toISOString().slice(0, 10);
      const safeName = s.name.replace(/[^\w぀-鿿]/g, '_');
      const dir = `${date}_${safeName}`;
      const { gpxContent, photos } = _buildSurveyZipContent(s);
      zip.file(`${dir}/track.gpx`, gpxContent);
      for (const { fname, dataUrl } of photos) {
        zip.file(`${dir}/photos/${fname}`, dataUrl.split(',')[1], { base64: true });
      }
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${folderName.replace(/[^\w぀-鿿]/g, '_')}_${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    toast('ZIPダウンロード完了', 2000);
  } catch (e) { toast('ZIP作成に失敗しました', 2000); console.error(e); }
}

function _currentSeg() { return _trackSegments.length ? _trackSegments[_trackSegments.length - 1] : null; }
function _totalPoints() { return _trackSegments.reduce((s, seg) => s + seg.length, 0); }

function _updateTrackLine() {
  const seg = _currentSeg();
  if (!seg || seg.length < 2) return;
  const idx = _trackSegments.length - 1;
  const latlngs = seg.map(p => [p.lat, p.lng]);
  if (_trackLines[idx]) { _trackLines[idx].setLatLngs(latlngs); }
  else { _trackLines[idx] = L.polyline(latlngs, { color: '#e53935', weight: 4, opacity: 0.85, pane: 'gpxPane' }).addTo(map); }
}


function _importGPX(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const gpx  = new DOMParser().parseFromString(e.target.result, 'application/xml');
      const pts  = Array.from(gpx.querySelectorAll('trkpt'));
      if (!pts.length) { toast('トラックポイントが見つかりません', 2500); return; }
      const latlngs = pts.map(p => [parseFloat(p.getAttribute('lat')), parseFloat(p.getAttribute('lon'))]);
      if (_importedTrackLine) map.removeLayer(_importedTrackLine);
      _importedTrackLine = L.polyline(latlngs, { color: '#e53935', weight: 4, opacity: 0.9, pane: 'gpxPane' }).addTo(map);
      map.fitBounds(_importedTrackLine.getBounds(), { padding: [40, 40] });
      toast(`GPX読み込み完了（${pts.length}点）`, 2000);
      _buildTrackCtrl();
    } catch(_) { toast('GPXの読み込みに失敗しました', 2500); }
  };
  reader.readAsText(file);
}

function _appendImportBtn(div) {
  const lbl = document.createElement('label');
  lbl.className = 'track-btn'; lbl.textContent = '📂 ファイル読込';
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.gpx,.tif,.tiff,.geojson,.json,.gpkg,.zip';
  inp.style.display = 'none';
  inp.onchange = e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.gpx')) _importGPX(file);
    else if (name.endsWith('.tif') || name.endsWith('.tiff')) _loadGeoTIFF(file);
    else if (name.endsWith('.geojson') || name.endsWith('.json')) _loadGeoJSON(file);
    else if (name.endsWith('.gpkg')) _loadGPKG(file);
    else if (name.endsWith('.zip')) _loadSurveyZip(file);
  };
  lbl.appendChild(inp); div.appendChild(lbl);
}

/* 調査ZIPの読み込み */
async function _loadSurveyZip(file) {
  toast('ZIP 読み込み中...', 3000);
  try {
    const zip = await JSZip.loadAsync(file);

    // サブフォルダ内の track.gpx を探す（ルート直下の track.gpx も対象）
    const gpxPaths = Object.keys(zip.files).filter(p => p.endsWith('track.gpx'));
    if (!gpxPaths.length) { toast('調査データが見つかりません', 2500); return; }

    let loaded = 0;
    for (const gpxPath of gpxPaths) {
      const dir = gpxPath.replace('track.gpx', ''); // 例: "2026-08-21_午前調査/"
      const dirBase = dir.replace(/\/$/, '');        // 例: "2026-08-21_午前調査"
      const surveyName = dirBase.replace(/^\d{4}-\d{2}-\d{2}_?/, '') || file.name.replace(/\.zip$/i, '');
      const dateMatch = dirBase.match(/^(\d{4}-\d{2}-\d{2})/);

      const gpxText = await zip.files[gpxPath].async('string');
      const gpx = new DOMParser().parseFromString(gpxText, 'application/xml');

      // トラック解析
      const segments = [];
      for (const trkseg of gpx.querySelectorAll('trkseg')) {
        const pts = Array.from(trkseg.querySelectorAll('trkpt')).map(p => ({
          lat: parseFloat(p.getAttribute('lat')),
          lng: parseFloat(p.getAttribute('lon')),
          ts:  p.querySelector('time')?.textContent || new Date().toISOString(),
        }));
        if (pts.length) segments.push(pts);
      }

      // ウェイポイント解析（写真も復元）
      const waypoints = [];
      for (const wpt of gpx.querySelectorAll('wpt')) {
        const lat     = parseFloat(wpt.getAttribute('lat'));
        const lng     = parseFloat(wpt.getAttribute('lon'));
        const comment = wpt.querySelector('name')?.textContent || '';
        const ts      = wpt.querySelector('time')?.textContent || new Date().toISOString();
        const href    = wpt.querySelector('link')?.getAttribute('href') || '';

        let photoData = null;
        if (href) {
          const photoPath = dir + href; // 例: "2026-08-21_午前調査/photos/001_枯損木.jpg"
          const photoFile = zip.files[photoPath];
          if (photoFile) {
            const b64 = await photoFile.async('base64');
            photoData = `data:image/jpeg;base64,${b64}`;
          }
        }
        waypoints.push({ lat, lng, comment, ts, photoData });
      }

      const survey = {
        name:      surveyName || '読み込み調査',
        folderId:  null,
        startedAt: dateMatch ? `${dateMatch[1]}T00:00:00.000Z` : new Date().toISOString(),
        savedAt:   new Date().toISOString(),
        segments,
        waypoints,
      };
      await _idbPut(survey);
      loaded++;
    }

    toast(`${loaded}件の調査を読み込みました`, 2500);
    _showSurveyManager();
  } catch (e) {
    toast('ZIP読み込みに失敗しました', 2500);
    console.error(e);
  }
}

function _buildTrackCtrl() {
  const div = document.getElementById('trackCtrl');
  if (!div) return;
  div.innerHTML = '';
  if (_trackActive) {
    const info = document.createElement('div');
    info.className = 'track-info'; info.id = 'trackInfo';
    const segCount = _trackSegments.length;
    const wptPart  = _waypoints.length ? ` ${_waypoints.length}wpt` : '';
    info.textContent = `🔴 記録中 ${_totalPoints()}点${wptPart}${segCount > 1 ? ' (' + segCount + '区間)' : ''}`;
    div.appendChild(info);
    const stopBtn = document.createElement('button');
    stopBtn.className = 'track-btn'; stopBtn.textContent = '⏹ 停止';
    stopBtn.onclick = () => { _trackActive = false; _autoSaveSurvey(); _buildTrackCtrl(); };
    div.appendChild(stopBtn);
  } else if (_totalPoints() > 0 || _waypoints.length > 0) {
    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'track-btn'; resumeBtn.textContent = '⏺ 続けてログ開始';
    resumeBtn.onclick = () => {
      _trackSegments.push([]); _lastTrackPoint = null; _trackActive = true;
      _startGPS(); toast('新しい区間を開始しました', 1500); _buildTrackCtrl();
    };
    div.appendChild(resumeBtn);
    const gpxBtn = document.createElement('button');
    gpxBtn.className = 'track-btn'; gpxBtn.textContent = '💾 GPX書き出し';
    gpxBtn.onclick = _exportCurrentGPX;
    div.appendChild(gpxBtn);
    const mgrBtn = document.createElement('button');
    mgrBtn.className = 'track-btn'; mgrBtn.textContent = '🗂 管理';
    mgrBtn.onclick = _showSurveyManager;
    div.appendChild(mgrBtn);
    const clrBtn = document.createElement('button');
    clrBtn.className = 'track-btn'; clrBtn.textContent = '🗑 消去';
    clrBtn.onclick = () => {
      _trackSegments = []; _trackLines.forEach(l => { if (l) map.removeLayer(l); }); _trackLines = [];
      _clearWaypoints(); _surveyId = null; _surveyName = ''; _surveyFolderId = null; _surveyStartedAt = null;
      _buildTrackCtrl();
    };
    div.appendChild(clrBtn);
  } else {
    const startBtn = document.createElement('button');
    startBtn.className = 'track-btn'; startBtn.textContent = '⏺ ログ開始';
    startBtn.onclick = () => {
      _surveyStartedAt = new Date().toISOString(); _surveyId = null;
      _trackSegments.push([]); _lastTrackPoint = null; _trackActive = true;
      _startGPS(); toast('ログ記録を開始しました', 1500); _buildTrackCtrl();
    };
    div.appendChild(startBtn);
    _appendImportBtn(div);
    const mgrBtn = document.createElement('button');
    mgrBtn.className = 'track-btn'; mgrBtn.textContent = '🗂 管理';
    mgrBtn.onclick = _showSurveyManager;
    div.appendChild(mgrBtn);
    if (_importedTrackLine) {
      const clrBtn = document.createElement('button');
      clrBtn.className = 'track-btn'; clrBtn.textContent = '🗑 GPX消去';
      clrBtn.onclick = () => { map.removeLayer(_importedTrackLine); _importedTrackLine = null; _buildTrackCtrl(); };
      div.appendChild(clrBtn);
    }
  }
}

const trackControl = L.control({ position: 'bottomright' });
trackControl.onAdd = function() {
  const div = L.DomUtil.create('div', 'track-ctrl');
  div.id = 'trackCtrl';
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  return div;
};
trackControl.addTo(map);
setTimeout(_buildTrackCtrl, 0);

/* ─── カメラ・ポイント・印刷 ボタン群（topleft） ─── */
(function() {
  /* カメラ・ポイントの位置：現在地GPS優先、なければマップ中心 */
  function _currentLatlng() {
    if (_lastKnownPos) {
      return L.latLng(_lastKnownPos.coords.latitude, _lastKnownPos.coords.longitude);
    }
    return map.getCenter();
  }

  /* ポイントボタン */
  function _onPointBtn() {
    _showWaypointDialog(_currentLatlng());
  }

  /* カメラボタン：写真を撮ってからダイアログ */
  const camInput = document.getElementById('cameraInput');
  function _onCameraBtn() {
    // 前回の onChange をリセット
    camInput.value = '';
    camInput.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const latlng = _currentLatlng();
      const photoData = await _compressImage(file);
      _showWaypointDialog(latlng, photoData);
    };
    camInput.click();
  }

  /* 印刷ボタン */
  function _onPrintBtn() {
    if (window._openPrintFrame) window._openPrintFrame();
  }

  const btns = [
    { id: 'btnCamera', icon: '📷', title: '写真を撮る',    fn: _onCameraBtn },
    { id: 'btnPoint',  icon: '📍', title: 'ポイントを追加', fn: _onPointBtn  },
    { id: 'btnPrint',  icon: '🖨️', title: '印刷',          fn: _onPrintBtn  },
  ];
  btns.forEach(b => {
    const ctrl = L.control({ position: 'topleft' });
    ctrl.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const a   = L.DomUtil.create('a', '', div);
      a.id    = b.id;
      a.href  = '#';
      a.title = b.title;
      a.setAttribute('role', 'button');
      a.setAttribute('aria-label', b.title);
      a.style.cssText = 'font-size:16px;line-height:30px;';
      a.textContent   = b.icon;
      L.DomEvent
        .on(a, 'mousedown dblclick touchstart', L.DomEvent.stopPropagation)
        .on(a, 'click', L.DomEvent.stop)
        .on(a, 'click', b.fn);
      return div;
    };
    ctrl.addTo(map);
  });
})();

/* ─── GPS 制御（ボタン押下時に起動）─── */
function _startGPS() {
  if (_watchId !== null || !navigator.geolocation) return;
  _watchId = navigator.geolocation.watchPosition(
    pos => {
      _lastKnownPos = pos;
      window._lastKnownPos = pos;
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      if (!_gpsInitDone) {
        _gpsInitDone = true;
        _lastProgrammaticPan = Date.now();
        map.setView(latlng, Math.max(map.getZoom(), currentLocationZoom), { animate: true });
        const btn = document.getElementById('btnCurrentLoc');
        if (btn) btn.classList.remove('loading');
      } else if (_follow) {
        _lastProgrammaticPan = Date.now();
        map.panTo(latlng, { animate: true, duration: 0.5 });
      }
      if (!currentLocationMarker) {
        currentLocationMarker = L.circleMarker(latlng, {
          radius: 8, color: '#2979ff', fillColor: '#3399ff', fillOpacity: 0.9, weight: 2
        }).addTo(map);
      } else {
        currentLocationMarker.setLatLng(latlng);
      }
      if (currentLocationCircle) map.removeLayer(currentLocationCircle);
      if (pos.coords.accuracy) {
        currentLocationCircle = L.circle(latlng, {
          radius: pos.coords.accuracy, color: '#2979ff', weight: 1, fillColor: '#2979ff', fillOpacity: 0.1
        }).addTo(map);
      }
      if (_trackActive) {
        const seg = _currentSeg();
        if (seg) {
          const acc = pos.coords.accuracy || 999;
          const lat = pos.coords.latitude, lng = pos.coords.longitude;
          const ts  = pos.timestamp;
          const info = document.getElementById('trackInfo');
          const segCount = _trackSegments.length;
          let skip = false;
          /* 精度フィルタ */
          if (acc > GPS_MAX_LOG_ACCURACY) skip = true;
          /* 飛び検出（前回点との速度チェック） */
          if (!skip && _lastTrackPoint) {
            const dt = (ts - _lastTrackPoint.ts) / 1000;
            if (dt > 0 && _latLngDistM(_lastTrackPoint.lat, _lastTrackPoint.lng, lat, lng) / dt > GPS_MAX_JUMP_SPEED) skip = true;
          }
          const wptPart = _waypoints.length ? ` ${_waypoints.length}wpt` : '';
          if (skip) {
            if (info) info.textContent = `🔴 記録中 ${_totalPoints()}点${wptPart}${segCount > 1 ? ' (' + segCount + '区間)' : ''} ⚠️${Math.round(acc)}m`;
          } else {
            seg.push({ lat, lng, ts: new Date(ts).toISOString() });
            _lastTrackPoint = { lat, lng, ts };
            _updateTrackLine();
            _autoSaveSurvey();
            if (info) info.textContent = `🔴 記録中 ${_totalPoints()}点${wptPart}${segCount > 1 ? ' (' + segCount + '区間)' : ''}`;
          }
        }
      }
    },
    () => {
      toast('現在地を取得できませんでした', 3000);
      const btn = document.getElementById('btnCurrentLoc');
      if (btn) btn.classList.remove('loading');
      _watchId = null;
    },
    { enableHighAccuracy: _isMobile, timeout: 30000, maximumAge: 5000 }
  );
}

/* ─── スケールバー ─── */
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);


/* 版数ラベル（右下隅・デバッグ用） */
(function() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:4px;right:6px;font-size:10px;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000;z-index:9999;pointer-events:none;';
  el.textContent = APP_VER;
  document.body.appendChild(el);
})();

/* ─── 印刷機能 ─── */
(function() {
  var _pfLandscape = false;
  var _pfCenter = null;
  var _pfBounds = null;
  var A4_W = 794, A4_H = 1123;

  function _pfUpdateFrame() {
    var box = document.getElementById('printFrameBox');
    var vw = window.innerWidth, vh = window.innerHeight;
    var margin = 36, barH = 70;
    var aw = vw - margin * 2, ah = vh - barH - margin * 2;
    var ratio = 297 / 210;
    var fw, fh;
    if (_pfLandscape) {
      if (aw / ratio <= ah) { fw = aw; fh = fw / ratio; }
      else { fh = ah; fw = fh * ratio; }
    } else {
      if (aw * ratio <= ah) { fw = aw; fh = fw * ratio; }
      else { fh = ah; fw = fh / ratio; }
    }
    box.style.width  = fw + 'px';
    box.style.height = fh + 'px';
    box.style.left   = ((vw - fw) / 2) + 'px';
    box.style.top    = margin + 'px';
  }

  function _buildPrintMeta(title) {
    var now = new Date();
    var pad = function(n) { return String(n).padStart(2, '0'); };
    var dateStr = now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) +
                  ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    var center = map.getCenter();
    var zoom   = map.getZoom();
    document.getElementById('printHeaderMapTitle').textContent = title || '宮城県森林計画図';
    document.getElementById('printHeaderMeta').textContent =
      dateStr + ' | 緯度 ' + center.lat.toFixed(5) + ' 経度 ' + center.lng.toFixed(5) + ' | Zoom ' + zoom;
    var scaleRaw = parseInt(document.getElementById('printScaleInput').value, 10);
    var scaleDom = document.getElementById('printHeaderScale');
    var mapScale = document.getElementById('printMapScale');
    if (scaleRaw > 0) {
      var txt = '縮尺 1/' + scaleRaw.toLocaleString();
      scaleDom.textContent = txt; scaleDom.style.display = '';
      mapScale.textContent = txt; mapScale.style.display = '';
    } else {
      scaleDom.textContent = ''; scaleDom.style.display = 'none';
      mapScale.textContent = ''; mapScale.style.display = 'none';
    }
  }

  window._openPrintFrame = function() {
    _pfLandscape = false;
    _pfCenter = null; _pfBounds = null;
    document.getElementById('printFrameOrient').textContent = '横向き';
    document.getElementById('printFrame').classList.add('show');
    _pfUpdateFrame();
  };

  document.getElementById('printFrameOrient').addEventListener('click', function() {
    _pfLandscape = !_pfLandscape;
    document.getElementById('printFrameOrient').textContent = _pfLandscape ? '縦向き' : '横向き';
    _pfUpdateFrame();
  });

  document.getElementById('printFrameCancel').addEventListener('click', function() {
    document.getElementById('printFrame').classList.remove('show');
  });

  document.getElementById('printFrameNext').addEventListener('click', function() {
    var box   = document.getElementById('printFrameBox');
    var mapEl = map.getContainer();
    var bRect = box.getBoundingClientRect();
    var mRect = mapEl.getBoundingClientRect();
    var tl = map.containerPointToLatLng(L.point(bRect.left - mRect.left, bRect.top    - mRect.top));
    var br = map.containerPointToLatLng(L.point(bRect.right - mRect.left, bRect.bottom - mRect.top));
    _pfBounds = L.latLngBounds(tl, br);
    _pfCenter = _pfBounds.getCenter();
    document.getElementById('printFrame').classList.remove('show');
    document.getElementById('printMapTitle').value   = '';
    document.getElementById('printScaleInput').value = '';
    document.getElementById('printModal').classList.add('show');
    setTimeout(function() { document.getElementById('printMapTitle').focus(); }, 100);
  });

  window.addEventListener('resize', function() {
    if (document.getElementById('printFrame').classList.contains('show')) _pfUpdateFrame();
  });

  document.getElementById('printCancel').addEventListener('click', function() {
    document.getElementById('printModal').classList.remove('show');
  });

  document.getElementById('printOk').addEventListener('click', function() {
    var title = document.getElementById('printMapTitle').value.trim();
    document.getElementById('printModal').classList.remove('show');
    _buildPrintMeta(title);

    var hdr  = document.getElementById('printHeader');
    hdr.style.display = 'flex';
    var hdrH = hdr.offsetHeight;
    hdr.style.display = '';

    document.getElementById('printNorthOnMap').style.top = (hdrH + 6) + 'px';

    var ds = document.getElementById('_pfDynStyle');
    if (!ds) { ds = document.createElement('style'); ds.id = '_pfDynStyle'; document.head.appendChild(ds); }
    ds.textContent = '@media print{#map{top:' + hdrH + 'px !important;height:calc(100vh - ' + hdrH + 'px) !important;}}';

    var s = document.getElementById('_pfOrientStyle');
    if (!s) { s = document.createElement('style'); s.id = '_pfOrientStyle'; document.head.appendChild(s); }
    s.textContent = _pfLandscape ? '@page{size:A4 landscape;}' : '@page{size:A4 portrait;}';

    if (_pfBounds && _pfCenter) {
      var paperW = _pfLandscape ? A4_H : A4_W;
      var paperH = (_pfLandscape ? A4_W : A4_H) - hdrH;
      var origCenter = map.getCenter();
      var origZoom   = map.getZoom();
      var mapEl      = map.getContainer();
      var origW      = mapEl.style.width;
      var origH      = mapEl.style.height;
      var origSnap   = map.options.zoomSnap;
      mapEl.style.width  = paperW + 'px';
      mapEl.style.height = paperH + 'px';
      map.invalidateSize({ animate: false });
      map.options.zoomSnap = 0;
      map.fitBounds(_pfBounds, { animate: false, padding: [0, 0] });
      setTimeout(function() {
        window.print();
        window.addEventListener('afterprint', function() {
          mapEl.style.width  = origW;
          mapEl.style.height = origH;
          map.options.zoomSnap = origSnap;
          map.invalidateSize({ animate: false });
          map.setView(origCenter, origZoom, { animate: false });
          document.getElementById('printNorthOnMap').style.top = '';
          ds.textContent = '';
        }, { once: true });
      }, 600);
    } else {
      setTimeout(function() { window.print(); }, 80);
    }
  });

  document.getElementById('printMapTitle').addEventListener('keydown', function(e) {
    if (e.key === 'Enter')  document.getElementById('printOk').click();
    if (e.key === 'Escape') document.getElementById('printCancel').click();
  });
})();

/* ─── CRS表示（左下）─── */
const crsControl = L.control({ position: 'bottomleft' });
crsControl.onAdd = function() {
  const div = L.DomUtil.create('div', 'crs-display');
  div.innerHTML = '<span class="crs-label">EPSG:4326</span><span class="crs-coords" id="crsCoords"></span>';
  L.DomEvent.disableClickPropagation(div);
  return div;
};
crsControl.addTo(map);

function _updateCrsCoords(latlng) {
  const el = document.getElementById('crsCoords');
  if (!el) return;
  const lat = latlng.lat.toFixed(5);
  const lng = latlng.lng.toFixed(5);
  el.textContent = `${lat}, ${lng}`;
}

map.on('mousemove', e => _updateCrsCoords(e.latlng));
map.on('move',      () => _updateCrsCoords(map.getCenter()));

map.on('dragstart', () => {
  if (Date.now() - _lastProgrammaticPan < 300) return;
  if (_follow) {
    _follow = false;
    const btn = document.getElementById('btnCurrentLoc');
    if (btn) btn.classList.remove('active');
  }
});

/* ─── ファイルドロップ（PC）─── */
(function() {
  const mapEl = map.getContainer();
  mapEl.addEventListener('dragover', e => { e.preventDefault(); mapEl.classList.add('drag-over'); });
  mapEl.addEventListener('dragleave', e => {
    if (!mapEl.contains(e.relatedTarget)) mapEl.classList.remove('drag-over');
  });
  mapEl.addEventListener('drop', e => {
    e.preventDefault();
    mapEl.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.tif') || name.endsWith('.tiff')) {
      _loadGeoTIFF(file);
    } else if (name.endsWith('.gpx')) {
      _importGPX(file);
    } else if (name.endsWith('.geojson') || name.endsWith('.json')) {
      _loadGeoJSON(file);
    } else if (name.endsWith('.gpkg')) {
      _loadGPKG(file);
    } else {
      toast('対応形式: GeoTIFF / GPX / GeoJSON / GeoPackage', 3000);
    }
  });
})();
