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
map.getPane('kobandanPane').style.zIndex = 403;  // 小林班
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
    <div class="popup-title">🌲 小林班: ${p['小班'] || ''}</div>
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
  if (name === '小林班') return makeForestPopup(props);
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
  url: 'data/小林班.pmtiles', maxDataZoom: 18,
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
  '小林班': {
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
      style: { color: '#b8860b', weight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round' },
      onEachFeature: (f, layer) => {
        layer.bindPopup(`<b>計画路網</b><br>ID: ${f.properties['id'] || '―'}`);
      }
    });
    const _roadsInner = L.geoJSON(data, {
      pane: 'roadsPane',
      style: { color: '#ffe000', weight: 3, opacity: 1, lineCap: 'round', lineJoin: 'round' },
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
    ['小林班' + mkLegend([['#ff0000', '小班境界', 'line']])]:
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

  const tiffLbl = document.createElement('label');
  tiffLbl.className = 'tb-btn';
  tiffLbl.innerHTML = '<span class="ico">🗺</span><span>GeoTIFF</span>';
  const tiffInp = document.createElement('input');
  tiffInp.type = 'file'; tiffInp.accept = '.tif,.tiff'; tiffInp.style.display = 'none';
  tiffInp.onchange = e => { _loadGeoTIFF(e.target.files[0]); e.target.value = ''; };
  tiffLbl.appendChild(tiffInp);

  tbDiv.appendChild(curBtn);
  tbDiv.appendChild(tiffLbl);
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

async function _loadGeoTIFF(file) {
  if (!file) return;
  toast('GeoTIFF読み込み中...', 8000);
  try {
    const buf = await file.arrayBuffer();
    const georaster = await parseGeoraster(buf);
    if (_geotiffLayer) { map.removeLayer(_geotiffLayer); }
    _geotiffLayer = new GeoRasterLayer({ georaster, opacity: 0.75, resolution: 256 });
    _geotiffLayer.addTo(map);
    map.fitBounds(_geotiffLayer.getBounds());
    toast('GeoTIFF読み込み完了', 2000);
    _showGeotiffCard(file.name);
  } catch (err) {
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
  const short = name.length > 24 ? name.slice(0, 21) + '...' : name;
  card.innerHTML = `<span>🗺 ${short}</span><button id="geotiffCardClose">✕ 解除</button>`;
  document.getElementById('geotiffCardClose').onclick = () => {
    if (_geotiffLayer) { map.removeLayer(_geotiffLayer); _geotiffLayer = null; }
    card.remove();
  };
}

/* ─── GPSログ・GPXインポート ─── */
let _trackSegments = [], _trackLines = [], _trackActive = false, _importedTrackLine = null;
let currentLocationMarker = null, currentLocationCircle = null, _lastKnownPos = null;
let _watchId = null, _follow = false, _gpsInitDone = false, _lastProgrammaticPan = 0;

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

function _exportGPX() {
  if (!_totalPoints()) { toast('記録がありません', 1500); return; }
  const name = new Date().toLocaleString('ja-JP',
    { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GeoForest Map" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk><name>${name}</name>\n`;
  for (const seg of _trackSegments) {
    if (!seg.length) continue;
    xml += `    <trkseg>\n`;
    for (const p of seg) xml += `      <trkpt lat="${p.lat}" lon="${p.lng}"><time>${p.ts}</time></trkpt>\n`;
    xml += `    </trkseg>\n`;
  }
  xml += `  </trk>\n</gpx>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([xml], { type: 'application/gpx+xml' }));
  a.download = `track_${new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')}.gpx`;
  a.click();
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
  lbl.className = 'track-btn'; lbl.textContent = '📂 GPX読込';
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.gpx'; inp.style.display = 'none';
  inp.onchange = e => { _importGPX(e.target.files[0]); e.target.value = ''; };
  lbl.appendChild(inp); div.appendChild(lbl);
}

function _buildTrackCtrl() {
  const div = document.getElementById('trackCtrl');
  if (!div) return;
  div.innerHTML = '';
  if (_trackActive) {
    const info = document.createElement('div');
    info.className = 'track-info'; info.id = 'trackInfo';
    const segCount = _trackSegments.length;
    info.textContent = `🔴 記録中 ${_totalPoints()}点${segCount > 1 ? ' (' + segCount + '区間)' : ''}`;
    div.appendChild(info);
    const stopBtn = document.createElement('button');
    stopBtn.className = 'track-btn'; stopBtn.textContent = '⏹ 停止';
    stopBtn.onclick = () => { _trackActive = false; _buildTrackCtrl(); };
    div.appendChild(stopBtn);
  } else if (_totalPoints() > 0) {
    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'track-btn'; resumeBtn.textContent = '⏺ 続けてログ開始';
    resumeBtn.onclick = () => {
      _trackSegments.push([]);
      _trackActive = true;
      _startGPS();
      toast('新しい区間を開始しました', 1500);
      _buildTrackCtrl();
    };
    div.appendChild(resumeBtn);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'track-btn'; saveBtn.textContent = '💾 GPX保存';
    saveBtn.onclick = _exportGPX;
    div.appendChild(saveBtn);
    const clrBtn = document.createElement('button');
    clrBtn.className = 'track-btn'; clrBtn.textContent = '🗑 ログ消去';
    clrBtn.onclick = () => {
      _trackSegments = [];
      _trackLines.forEach(l => { if (l) map.removeLayer(l); });
      _trackLines = [];
      _buildTrackCtrl();
    };
    div.appendChild(clrBtn);
  } else {
    const startBtn = document.createElement('button');
    startBtn.className = 'track-btn'; startBtn.textContent = '⏺ ログ開始';
    startBtn.onclick = () => {
      _trackSegments.push([]);
      _trackActive = true;
      _startGPS();
      toast('ログ記録を開始しました', 1500);
      _buildTrackCtrl();
    };
    div.appendChild(startBtn);
    _appendImportBtn(div);
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
          seg.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, ts: new Date(pos.timestamp).toISOString() });
          _updateTrackLine();
          const info = document.getElementById('trackInfo');
          const segCount = _trackSegments.length;
          if (info) info.textContent = `🔴 記録中 ${_totalPoints()}点${segCount > 1 ? ' (' + segCount + '区間)' : ''}`;
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

/* ─── 印刷ボタン ─── */
const printControl = L.control({ position: 'topleft' });
printControl.onAdd = function() {
  var div  = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
  var link = L.DomUtil.create('a', '', div);
  link.id   = 'btnPrint';
  link.href = '#';
  link.title = '印刷';
  link.setAttribute('role', 'button');
  link.setAttribute('aria-label', '印刷');
  link.style.cssText = 'font-size:16px;line-height:30px;';
  link.textContent = '🖨️';
  L.DomEvent
    .on(link, 'mousedown dblclick touchstart', L.DomEvent.stopPropagation)
    .on(link, 'click', L.DomEvent.stop)
    .on(link, 'click', function() {
      if (window._openPrintFrame) window._openPrintFrame();
    });
  return div;
};
printControl.addTo(map);

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
    } else {
      toast('GeoTIFF (.tif/.tiff) または GPX (.gpx) をドロップしてください', 3000);
    }
  });
})();
