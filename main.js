const fallbackLocation = [38.767, 141.441]; // 気仙沼市（小林班データ中心）
const fallbackZoom = 14;
const gsiAttribution =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>';

const map = L.map("map", {
  zoomControl: true,
  maxZoom: 22
}).setView(fallbackLocation, fallbackZoom);

/* 計画路網を常に最前面に表示するカスタムペイン（overlayPane=400 より高い） */
map.createPane('roadsPane');
map.getPane('roadsPane').style.zIndex = 450;

/* ─── ベースレイヤ ─── */
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
  {
    attribution: gsiAttribution,
    maxNativeZoom: 15,
    maxZoom: 22,
    className: "bm-multiply",
    opacity: 0.7
  }
);

gsiStandard.addTo(map);

/* ─── 林種の色定義 ─── */
const LINSHU_COLOR = {
  '人工林':   { fill: 'rgba(100,180,220,0.45)', stroke: 'rgba(30,100,160,0.8)' },
  '天然林':   { fill: 'rgba(60,160,80,0.45)',   stroke: 'rgba(20,100,40,0.8)'  },
  '伐採跡地': { fill: 'rgba(210,160,80,0.55)',  stroke: 'rgba(160,100,20,0.8)' },
  '竹林':     { fill: 'rgba(160,200,100,0.5)',  stroke: 'rgba(80,140,20,0.8)'  },
  '未立木地': { fill: 'rgba(200,200,180,0.5)',  stroke: 'rgba(120,120,90,0.8)' },
};

function linshuStyle(feature) {
  const c = LINSHU_COLOR[feature.properties['林種']] ||
    { fill: 'rgba(160,160,160,0.4)', stroke: 'rgba(80,80,80,0.7)' };
  return { fillColor: c.fill, color: c.stroke, weight: 0.8, fillOpacity: 1 };
}

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

/* ─── GeoJSONレイヤ ─── */
let layers = {};
let loadCount = 0;
const totalLayers = 5;

function onLayerLoaded() {
  loadCount++;
  if (loadCount >= totalLayers) {
    const el = document.getElementById('loadingIndicator');
    if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 400); }
    addLayerControl();
  }
}

/* 調査範囲 */
fetch('data/調査範囲.geojson')
  .then(r => r.json())
  .then(data => {
    layers['調査範囲'] = L.geoJSON(data, {
      style: { color: '#333', weight: 2, fillOpacity: 0, dashArray: '6 4' }
    });
    onLayerLoaded();
  });

/* 林班 */
fetch('data/林班.geojson')
  .then(r => r.json())
  .then(data => {
    layers['林班'] = L.geoJSON(data, {
      style: { color: '#1a5f2a', weight: 2.5, fillOpacity: 0, dashArray: '4 3' },
      onEachFeature: (f, layer) => {
        const p = f.properties;
        layer.bindTooltip(`林班 ${p['RINPAN']} (${p['SICHOSON_N']})`, { sticky: true });
        layer.bindPopup(`<b>林班: ${p['RINPAN']}</b><br>${p['SICHOSON_N']}`);
      }
    });
    onLayerLoaded();
  });

/* 準林班 */
fetch('data/準林班.geojson')
  .then(r => r.json())
  .then(data => {
    layers['準林班'] = L.geoJSON(data, {
      style: { color: '#2e7d32', weight: 1.5, fillOpacity: 0, dashArray: '3 3' },
      onEachFeature: (f, layer) => {
        const p = f.properties;
        layer.bindTooltip(`準林班 ${p['RINPAN']}${p['JUNRINPAN']}`, { sticky: true });
        layer.bindPopup(`<b>準林班: ${p['RINPAN']}${p['JUNRINPAN']}</b><br>${p['SICHOSON_N']}`);
      }
    });
    onLayerLoaded();
  });

/* 小林班 */
fetch('data/小林班.geojson')
  .then(r => r.json())
  .then(data => {
    layers['小林班'] = L.geoJSON(data, {
      style: linshuStyle,
      onEachFeature: (f, layer) => {
        layer.bindPopup(makeForestPopup(f.properties), { maxWidth: 280 });
        layer.on('mouseover', function(e) {
          this.setStyle({ weight: 2.5, fillOpacity: 0.85 });
        });
        layer.on('mouseout', function(e) {
          layers['小林班'].resetStyle(this);
        });
      }
    });
    layers['小林班'].addTo(map);
    onLayerLoaded();
  });

/* 計画路網 */
fetch('data/計画路網.geojson')
  .then(r => r.json())
  .then(data => {
    layers['計画路網'] = L.geoJSON(data, {
      pane: 'roadsPane',
      style: { color: '#e65100', weight: 3, dashArray: '8 4', opacity: 0.85 },
      onEachFeature: (f, layer) => {
        layer.bindPopup(`<b>計画路網</b><br>ID: ${f.properties['id']}`);
      }
    });
    layers['計画路網'].addTo(map);
    onLayerLoaded();
  });

/* ─── レイヤコントロール ─── */
function addLayerControl() {
  const baseMaps = {
    '標準地図': gsiStandard,
    '航空写真': gsiAirPhoto,
    '色別標高図': gsiRelief
  };

  const mkLegend = (items) => {
    const rows = items.map(([color, label]) =>
      `<span class="lgnd-row"><span class="lgnd-swatch lgnd-poly" style="background:${color};border:1px solid rgba(0,0,0,0.3)"></span>${label}</span>`
    ).join('');
    return `<span class="layer-legend">${rows}</span>`;
  };

  const overlayMaps = {
    ['調査範囲' + mkLegend([['transparent','境界(破線)']])]:
      layers['調査範囲'],

    ['林班' + mkLegend([['transparent','区画(破線)']])]:
      layers['林班'],

    ['準林班' + mkLegend([['transparent','区画(点線)']])]:
      layers['準林班'],

    ['小林班' + mkLegend([
      ['rgba(100,180,220,0.6)', '人工林'],
      ['rgba(60,160,80,0.6)',   '天然林'],
      ['rgba(210,160,80,0.6)', '伐採跡地'],
      ['rgba(160,200,100,0.6)','竹林'],
      ['rgba(200,200,180,0.6)','未立木地'],
    ])]:
      layers['小林班'],

    ['計画路網' + mkLegend([['#e65100','路網(破線)']])]:
      layers['計画路網'],
  };

  L.control.layers(baseMaps, overlayMaps, {
    position: 'topright',
    collapsed: false
  }).addTo(map);

  /* ベースレイヤ切り替えハンドラ */
  map.on('baselayerchange', e => {
    [gsiStandard, gsiAirPhoto, gsiRelief].forEach(l => {
      if (map.hasLayer(l)) map.removeLayer(l);
    });
    e.layer.addTo(map);
  });
}
