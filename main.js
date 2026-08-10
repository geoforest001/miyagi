const fallbackLocation = [38.767, 141.441]; // 気仙沼市（小林班データ中心）
const fallbackZoom = 14;
const currentLocationZoom = 15;
const _isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const gsiAttribution =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>';

const map = L.map("map", { zoomControl: true, maxZoom: 22 }).setView(fallbackLocation, fallbackZoom);

/* ─── カスタムペイン ─── */
map.createPane('gpxPane');
map.getPane('gpxPane').style.zIndex = 460;
map.createPane('roadsPane');
map.getPane('roadsPane').style.zIndex = 450;

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
  "https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png",
  { attribution: gsiAttribution, maxNativeZoom: 15, maxZoom: 22, className: "bm-multiply", opacity: 0.7 }
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
  { dataLayer: 'kobandan', symbolizer: new protomapsL.PolygonSymbolizer({ fill: 'rgba(0,0,0,0)', stroke: 'rgba(200,0,0,0.9)', width: 0.8 }) },
];

const kobandanTiles = protomapsL.leafletLayer({
  url: 'data/小林班.pmtiles', maxDataZoom: 18,
  paintRules: _kobandanPaintRules, labelRules: []
});
const rinpanTiles = protomapsL.leafletLayer({
  url: 'data/林班.pmtiles', maxDataZoom: 18,
  paintRules: [{ dataLayer: 'rinpan', symbolizer: new protomapsL.PolygonSymbolizer({ fill: 'rgba(0,0,0,0)', stroke: 'rgba(120,0,200,0.9)', width: 2.5 }) }],
  labelRules: []
});
const junrinpanTiles = protomapsL.leafletLayer({
  url: 'data/準林班.pmtiles', maxDataZoom: 18,
  paintRules: [{ dataLayer: 'junrinpan', symbolizer: new protomapsL.PolygonSymbolizer({ fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,160,0,0.85)', width: 1.5 }) }],
  labelRules: []
});

kobandanTiles.addTo(map);

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
      style: { color: '#333', weight: 2, fillOpacity: 0, dashArray: '6 4' }
    });
    _onLayerLoaded();
  });

fetch('data/計画路網.geojson')
  .then(r => r.json())
  .then(data => {
    _geoLayers['計画路網'] = L.geoJSON(data, {
      pane: 'roadsPane',
      style: { color: '#e65100', weight: 3, dashArray: '8 4', opacity: 0.85 },
      onEachFeature: (f, layer) => {
        layer.bindPopup(`<b>計画路網</b><br>ID: ${f.properties['id'] || '―'}`);
      }
    });
    _geoLayers['計画路網'].addTo(map);
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
    ['調査範囲' + mkLegend([['transparent', '境界', 'line']])]:
      _geoLayers['調査範囲'],
    ['林班' + mkLegend([['rgba(20,80,30,0.85)', '林班境界', 'line']])]:
      rinpanTiles,
    ['準林班' + mkLegend([['rgba(46,125,50,0.7)', '準林班境界', 'line']])]:
      junrinpanTiles,
    ['小林班' + mkLegend([
      ['rgba(100,180,220,0.6)', '人工林'],
      ['rgba(60,160,80,0.6)',   '天然林'],
      ['rgba(210,160,80,0.6)', '伐採跡地'],
      ['rgba(160,200,100,0.6)', '竹林'],
      ['rgba(200,200,180,0.6)', '未立木地'],
    ])]:
      kobandanTiles,
    ['計画路網' + mkLegend([['#e65100', '計画路網', 'line']])]:
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
  closeBtn.addEventListener('click', closePanel);
  openBtn.addEventListener('click', openPanel);

  /* ── ツールボックス ── */
  const tbDiv = document.createElement('div'); tbDiv.id = 'tbLayers';

  const curBtn = document.createElement('button');
  curBtn.className = 'tb-btn'; curBtn.id = 'btnCurrentLoc';
  curBtn.innerHTML = '<span class="ico">📍</span><span>現在地</span>';
  curBtn.addEventListener('click', function() {
    const btn = this; btn.classList.add('loading');
    if (_lastKnownPos && (Date.now() - _lastKnownPos.timestamp) < 30000) {
      map.setView([_lastKnownPos.coords.latitude, _lastKnownPos.coords.longitude],
        Math.max(map.getZoom(), currentLocationZoom));
      btn.classList.remove('loading'); return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        _lastKnownPos = pos;
        map.setView([pos.coords.latitude, pos.coords.longitude], Math.max(map.getZoom(), currentLocationZoom));
        btn.classList.remove('loading');
      },
      () => { toast('現在地を取得できませんでした', 3000); btn.classList.remove('loading'); },
      { enableHighAccuracy: _isMobile, timeout: 15000 }
    );
  });

  const xlsxBtn = document.createElement('button');
  xlsxBtn.className = 'tb-btn'; xlsxBtn.id = 'btnExcelLink';
  xlsxBtn.innerHTML = '<span class="ico">📊</span><span>Excel連携</span>';
  xlsxBtn.addEventListener('click', () => { if (window.xlsxOpenFile) window.xlsxOpenFile(); });

  tbDiv.appendChild(curBtn); tbDiv.appendChild(xlsxBtn);
  lcList.insertBefore(tbDiv, lcList.firstChild);

  /* ── ベースマップ セクション ── */
  const bmSep = document.createElement('div'); bmSep.className = 'leaflet-control-layers-separator';
  const bmLbl = document.createElement('div'); bmLbl.className = 'lc-section-label'; bmLbl.textContent = 'ベースマップ';
  lcList.insertBefore(bmSep, tbDiv.nextSibling);
  lcList.insertBefore(bmLbl, bmSep.nextSibling);

  const bmContainer = document.createElement('div');
  [
    { id: 'bmStd', label: '地理院標準地図', layer: gsiStandard, defVal: 1.0 },
    { id: 'bmAir', label: '航空写真',       layer: gsiAirPhoto, defVal: 0.0 },
    { id: 'bmRlf', label: '色別標高図',     layer: gsiRelief,   defVal: 0.0 },
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

/* ─── GPSログ・GPXインポート ─── */
let _trackPoints = [], _trackActive = false, _trackLine = null, _importedTrackLine = null;
let currentLocationMarker = null, currentLocationCircle = null, _lastKnownPos = null;

function _updateTrackLine() {
  if (_trackPoints.length < 2) return;
  const latlngs = _trackPoints.map(p => [p.lat, p.lng]);
  if (_trackLine) { _trackLine.setLatLngs(latlngs); }
  else { _trackLine = L.polyline(latlngs, { color: '#e53935', weight: 4, opacity: 0.85, pane: 'gpxPane' }).addTo(map); }
}

function _exportGPX() {
  if (!_trackPoints.length) { toast('記録がありません', 1500); return; }
  const name = new Date().toLocaleString('ja-JP',
    { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GeoForest Map" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk><name>${name}</name><trkseg>\n`;
  for (const p of _trackPoints) xml += `    <trkpt lat="${p.lat}" lon="${p.lng}"><time>${p.ts}</time></trkpt>\n`;
  xml += `  </trkseg></trk>\n</gpx>`;
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
    info.textContent = `🔴 記録中 ${_trackPoints.length}点`;
    div.appendChild(info);
    const stopBtn = document.createElement('button');
    stopBtn.className = 'track-btn'; stopBtn.textContent = '⏹ 停止';
    stopBtn.onclick = () => { _trackActive = false; _buildTrackCtrl(); };
    div.appendChild(stopBtn);
  } else if (_trackPoints.length > 0) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'track-btn'; saveBtn.textContent = '💾 GPX保存';
    saveBtn.onclick = _exportGPX;
    div.appendChild(saveBtn);
    const clrBtn = document.createElement('button');
    clrBtn.className = 'track-btn'; clrBtn.textContent = '🗑 ログ消去';
    clrBtn.onclick = () => {
      _trackPoints = [];
      if (_trackLine) { map.removeLayer(_trackLine); _trackLine = null; }
      _buildTrackCtrl();
    };
    div.appendChild(clrBtn);
  } else {
    const startBtn = document.createElement('button');
    startBtn.className = 'track-btn'; startBtn.textContent = '⏺ ログ開始';
    startBtn.onclick = () => { _trackActive = true; toast('ログ記録を開始しました', 1500); _buildTrackCtrl(); };
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

/* ─── 現在地 常時追跡 ─── */
if (navigator.geolocation) {
  let firstFix = true;
  navigator.geolocation.watchPosition(
    pos => {
      _lastKnownPos = pos;
      window._lastKnownPos = pos;
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      if (firstFix) { map.setView(latlng, currentLocationZoom); firstFix = false; }
      if (currentLocationMarker) map.removeLayer(currentLocationMarker);
      if (currentLocationCircle) map.removeLayer(currentLocationCircle);
      currentLocationMarker = L.circleMarker(latlng, {
        radius: 8, color: '#fff', weight: 3, fillColor: '#2979ff', fillOpacity: 1
      }).addTo(map);
      if (pos.coords.accuracy) {
        currentLocationCircle = L.circle(latlng, {
          radius: pos.coords.accuracy, color: '#2979ff', weight: 1, fillColor: '#2979ff', fillOpacity: 0.1
        }).addTo(map);
      }
      if (_trackActive) {
        _trackPoints.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, ts: new Date(pos.timestamp).toISOString() });
        _updateTrackLine();
        const info = document.getElementById('trackInfo');
        if (info) info.textContent = `🔴 記録中 ${_trackPoints.length}点`;
      }
    },
    () => { toast('現在地を取得できませんでした', 3000); },
    { enableHighAccuracy: _isMobile, timeout: 30000, maximumAge: 5000 }
  );
}

/* ─── スケールバー ─── */
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
