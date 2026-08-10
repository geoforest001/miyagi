/* =============================================
   Excel / CSV 連携モジュール (miyagi版)
   PMTiles + GeoJSON 両対応
   ============================================= */

let _xlsxRows         = [];
let _xlsxJoinMap      = null;
let _xlsxTargetName   = '';
let _xlsxKeyGeo       = '';
let _xlsxKeyXls       = '';
let _xlsxIsPmTiles    = false;
let _xlsxColorCol     = '';
let _xlsxColorApplied = false;

/* 汎用カラーパレット（最大5カテゴリ）*/
const _PALETTE = [
  { fill: 'rgba(76,175,80,0.72)',   stroke: 'rgba(27,94,32,0.85)',    width: 1.2 },
  { fill: 'rgba(255,193,7,0.80)',   stroke: 'rgba(200,120,0,0.85)',   width: 1.2 },
  { fill: 'rgba(33,150,243,0.65)', stroke: 'rgba(13,71,161,0.85)',   width: 1.2 },
  { fill: 'rgba(244,67,54,0.60)',  stroke: 'rgba(183,28,28,0.85)',   width: 1.2 },
  { fill: 'rgba(156,39,176,0.55)', stroke: 'rgba(74,20,140,0.85)',   width: 1.2 },
];

const _xlsxInput     = document.getElementById('xlsxInput');
const _xlsxModal     = document.getElementById('xlsxModal');
const _xlsxLayerSel  = document.getElementById('xlsxLayerSel');
const _xlsxKeyGeoSel = document.getElementById('xlsxKeyGeo');
const _xlsxKeyXlsSel = document.getElementById('xlsxKeyXls');
const _xlsxModalInfo = document.getElementById('xlsxModalInfo');
const _xlsxStatCard  = document.getElementById('xlsxStatCard');
const _xlsxStatText  = document.getElementById('xlsxStatText');

window.xlsxOpenFile = function() {
  _xlsxInput.value = '';
  _xlsxInput.click();
};

/* ── レイヤ一覧（GeoJSON + PMTiles）── */
function _getAllLayerNames() {
  var pmNames = new Set(Object.keys(window.pmLayers || {}));
  var names = [];
  Object.keys(window.overlays || {}).forEach(function(n) {
    if (!pmNames.has(n)) names.push({ name: n, type: 'geojson' });
  });
  pmNames.forEach(function(n) { names.push({ name: n, type: 'pmtiles' }); });
  return names;
}

/* ── GeoJSONレイヤのフィールド名 ── */
function _getGeoJsonFields(layerName) {
  var lyr = (window.overlays || {})[layerName];
  if (!lyr) return [];
  var fields = new Set();
  lyr.eachLayer(function(l) {
    var props = l.feature && l.feature.properties;
    if (props) Object.keys(props).forEach(function(k) { fields.add(k); });
  });
  return Array.from(fields);
}

/* ── レイヤ選択変更時にキー列を更新 ── */
function _updateGeoFields() {
  var name = _xlsxLayerSel.value;
  var pm   = window.pmLayers && window.pmLayers[name];
  var fields = pm ? pm.keys : _getGeoJsonFields(name);
  _xlsxKeyGeoSel.innerHTML = fields.length
    ? fields.map(function(f) { return '<option value="' + f + '">' + f + '</option>'; }).join('')
    : '<option value="">（フィールドなし）</option>';
  document.getElementById('xlsxColorRow').style.display = pm ? '' : 'none';
}

_xlsxLayerSel.addEventListener('change', _updateGeoFields);

/* ── モーダルを開く ── */
function _openXlsxModal() {
  var layers = _getAllLayerNames();
  if (!layers.length) {
    toast('レイヤが読み込まれていません', 3000); return;
  }
  _xlsxLayerSel.innerHTML = layers.map(function(l) {
    return '<option value="' + l.name + '">' + l.name + '</option>';
  }).join('');
  _updateGeoFields();
  _xlsxModal.classList.add('show');
}

/* ── CSV パーサー ── */
function _parseCsvLine(line) {
  var result = [], inQ = false, field = '';
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { result.push(field); field = ''; }
      else field += ch;
    }
  }
  result.push(field);
  return result;
}

function _parseCsv(text) {
  var lines = text.split(/\r?\n/);
  var headers = _parseCsvLine(lines[0]);
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    var vals = _parseCsvLine(lines[i]);
    var obj = {};
    headers.forEach(function(h, j) { obj[h] = vals[j] !== undefined ? vals[j] : ''; });
    rows.push(obj);
  }
  return rows;
}

/* ── ファイル読み込み ── */
_xlsxInput.addEventListener('change', function() {
  var f = _xlsxInput.files[0];
  if (!f) return;
  _xlsxRows = []; _xlsxKeyXlsSel.innerHTML = '';

  var isCsv = f.name.toLowerCase().endsWith('.csv');
  var rd = new FileReader();
  rd.onload = function(e) {
    try {
      if (isCsv) {
        var bytes = new Uint8Array(e.target.result);
        var text  = '';
        if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
          text = new TextDecoder('utf-8').decode(bytes.slice(3));
        } else if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
          text = new TextDecoder('utf-16le').decode(bytes.slice(2));
        } else {
          for (var enc of ['shift_jis', 'utf-8']) {
            try { text = new TextDecoder(enc).decode(bytes); break; } catch(_) {}
          }
        }
        _xlsxRows = _parseCsv(text);
      } else {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        _xlsxRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      }
      if (!_xlsxRows.length) { toast('データが空です', 2000); return; }
      var headers = Object.keys(_xlsxRows[0]);
      var opts = headers.map(function(h) {
        return '<option value="' + h + '">' + h + '</option>';
      }).join('');
      _xlsxKeyXlsSel.innerHTML = opts;
      document.getElementById('xlsxColorCol').innerHTML =
        '<option value="">── 色分けなし ──</option>' + opts;
      _xlsxModalInfo.textContent = _xlsxRows.length + '行 / ' + headers.length + '列 読み込み完了';
      _openXlsxModal();
    } catch(err) {
      toast('ファイルの読み込みに失敗しました: ' + err.message, 3000);
    }
  };
  rd.readAsArrayBuffer(f);
});

/* ── 連携する ── */
document.getElementById('xlsxModalOk').addEventListener('click', function() {
  _xlsxTargetName = _xlsxLayerSel.value;
  _xlsxKeyGeo    = _xlsxKeyGeoSel.value;
  _xlsxKeyXls    = _xlsxKeyXlsSel.value;
  _xlsxColorCol  = document.getElementById('xlsxColorCol').value;
  _xlsxIsPmTiles = !!(window.pmLayers && window.pmLayers[_xlsxTargetName]);

  _xlsxJoinMap = new Map();
  _xlsxRows.forEach(function(row) {
    var k = String(row[_xlsxKeyXls] !== undefined ? row[_xlsxKeyXls] : '').trim();
    if (k) _xlsxJoinMap.set(k, row);
  });

  _xlsxModal.classList.remove('show');
  _showXlsxStat();

  if (_xlsxIsPmTiles) {
    if (_xlsxColorCol) _applyPmTilesColorCoding();
    toast('Excel連携を設定しました（' + _xlsxJoinMap.size + '件）\nポリゴンをクリックしてデータを確認できます', 3000);
  } else {
    _rebindGeoJsonPopups();
    toast('Excel連携を設定しました（' + _xlsxJoinMap.size + '件）', 2500);
  }
});

document.getElementById('xlsxModalCancel').addEventListener('click', function() {
  _xlsxModal.classList.remove('show');
});

/* ── 統計カード ── */
function _showXlsxStat() {
  var matched = _xlsxJoinMap ? _xlsxJoinMap.size : 0;
  _xlsxStatText.textContent =
    '📊 Excel連携中 — ' + _xlsxTargetName + '/' + _xlsxKeyGeo +
    ' キー ' + matched.toLocaleString() + ' / ' + _xlsxRows.length.toLocaleString() + ' 件';
  _xlsxStatCard.style.display = 'flex';
}

document.getElementById('xlsxStatClose').addEventListener('click', function() {
  _xlsxStatCard.style.display = 'none';
  if (_xlsxColorApplied) _restorePmTilesStyle();
  _xlsxJoinMap = null; _xlsxRows = [];
  if (!_xlsxIsPmTiles) _rebindGeoJsonPopups();
  map.closePopup();
  toast('Excel連携を解除しました', 2000);
});

/* ── PMTilesクリックハンドラ ── */
map.on('click', function(e) {
  var pmLayers = window.pmLayers || {};
  for (var name of Object.keys(pmLayers)) {
    var cfg = pmLayers[name];
    if (!map.hasLayer(cfg.layer)) continue;

    var props = null;
    try {
      var results = cfg.layer.queryTileFeaturesDebug(e.latlng.lng, e.latlng.lat, 0);
      for (var entry of results) {
        for (var f of entry[1]) {
          if (f.layerName === cfg.dataLayer) { props = f.feature.props; break; }
        }
        if (props) break;
      }
    } catch(_) {}

    if (!props) continue;

    /* Excel連携中の場合: 結合テーブルを表示 */
    if (_xlsxJoinMap && _xlsxIsPmTiles && _xlsxTargetName === name) {
      var geoKey = String(props[_xlsxKeyGeo] !== undefined ? props[_xlsxKeyGeo] : '').trim();
      var xlRow  = _xlsxJoinMap.get(geoKey);
      var geoRows = Object.entries(props)
        .filter(function(kv) { return kv[1] != null && kv[1] !== ''; })
        .map(function(kv) { return '<tr><th>' + _esc(kv[0]) + '</th><td>' + _esc(String(kv[1])) + '</td></tr>'; })
        .join('');
      var xlRows = xlRow
        ? Object.entries(xlRow)
            .filter(function(kv) { return kv[0] !== _xlsxKeyXls; })
            .map(function(kv) { return '<tr class="xl-row"><th>📊 ' + _esc(kv[0]) + '</th><td>' + _esc(String(kv[1])) + '</td></tr>'; })
            .join('')
        : '<tr><td colspan="2" style="color:#aaa;font-size:11px">（Excelにデータなし）</td></tr>';
      var content = '<table class="xl-popup">' + geoRows +
        '<tr><td colspan="2" class="xl-sep">── Excel データ ──</td></tr>' + xlRows + '</table>';
      L.popup({ maxWidth: 280 }).setLatLng(e.latlng).setContent(content).openOn(map);
      break;
    }

    /* 通常クリック: レイヤ別フォーマットポップアップ */
    var custom = window.makeLayerPopup && window.makeLayerPopup(name, props);
    if (custom) {
      L.popup({ maxWidth: 280 }).setLatLng(e.latlng).setContent(custom).openOn(map);
    } else {
      var rows = Object.entries(props)
        .filter(function(kv) { return kv[1] != null && kv[1] !== ''; })
        .map(function(kv) { return '<tr><th>' + _esc(kv[0]) + '</th><td>' + _esc(String(kv[1])) + '</td></tr>'; })
        .join('');
      L.popup({ maxWidth: 280 }).setLatLng(e.latlng)
        .setContent('<table class="xl-popup">' + rows + '</table>').openOn(map);
    }
    break;
  }
});

/* ── GeoJSONポップアップ再バインド ── */
function _rebindGeoJsonPopups() {
  var lyr = (window.overlays || {})[_xlsxTargetName];
  if (!lyr) return;
  lyr.eachLayer(function(l) {
    if (!l.feature || !l.feature.properties) return;
    var props = l.feature.properties;
    if (_xlsxJoinMap) {
      var geoKey = String(props[_xlsxKeyGeo] !== undefined ? props[_xlsxKeyGeo] : '').trim();
      var xlRow  = _xlsxJoinMap.get(geoKey);
      var geoRows = Object.entries(props)
        .filter(function(e) { return e[1] != null && e[1] !== ''; })
        .map(function(e) { return '<tr><th>' + _esc(e[0]) + '</th><td>' + _esc(String(e[1])) + '</td></tr>'; })
        .join('');
      var xlRows = xlRow
        ? Object.entries(xlRow)
            .filter(function(e) { return e[0] !== _xlsxKeyXls; })
            .map(function(e) { return '<tr class="xl-row"><th>📊 ' + _esc(e[0]) + '</th><td>' + _esc(String(e[1])) + '</td></tr>'; })
            .join('')
        : '<tr><td colspan="2" style="color:#aaa;font-size:11px">（未マッチ）</td></tr>';
      l.bindPopup('<table class="xl-popup">' + geoRows +
        '<tr><td colspan="2" class="xl-sep">── Excel データ ──</td></tr>' + xlRows + '</table>',
        { maxWidth: 280 });
    } else {
      var rows = Object.entries(props)
        .filter(function(e) { return e[1] != null && e[1] !== ''; })
        .map(function(e) { return '<tr><th>' + _esc(e[0]) + '</th><td>' + _esc(String(e[1])) + '</td></tr>'; })
        .join('');
      if (rows) l.bindPopup('<table class="xl-popup">' + rows + '</table>');
    }
  });
}

function _esc(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' }[c];
  });
}

/* ── PMTiles 色分け適用 ── */
function _applyPmTilesColorCoding() {
  var cfg = window.pmLayers && window.pmLayers[_xlsxTargetName];
  if (!cfg) return;
  var layer = cfg.layer;

  if (!cfg._origPaintRules) cfg._origPaintRules = (layer.paintRules || []).slice();

  var keyGeo   = _xlsxKeyGeo;
  var colorCol = _xlsxColorCol;
  var joinMap  = _xlsxJoinMap;

  /* ユニーク値を収集（最大5カテゴリ）*/
  var uniqueVals = [];
  joinMap.forEach(function(row) {
    var v = String(row[colorCol] || '').trim();
    if (v && !uniqueVals.includes(v)) uniqueVals.push(v);
  });
  uniqueVals = uniqueVals.slice(0, _PALETTE.length);

  if (!uniqueVals.length) {
    toast('⚠️ 色分け列「' + colorCol + '」に値がありません', 4000); return;
  }

  var colorDefs = uniqueVals.map(function(val, i) {
    return { val: val, fill: _PALETTE[i].fill, stroke: _PALETTE[i].stroke, width: _PALETTE[i].width };
  });
  toast('🎨 色分け: ' + colorDefs.map(function(d) { return d.val; }).join(' / '), 4000);

  var rules = colorDefs.map(function(def) {
    return {
      dataLayer: cfg.dataLayer,
      symbolizer: new protomapsL.PolygonSymbolizer({ fill: def.fill, stroke: def.stroke, width: def.width }),
      filter: function(zoom, feature) {
        var k   = String(feature.props[keyGeo] || '').trim();
        var row = joinMap.get(k);
        return !!(row && String(row[colorCol] || '').trim() === def.val);
      }
    };
  });

  /* フォールバック: Excelにない or カテゴリ外 */
  rules.unshift({
    dataLayer: cfg.dataLayer,
    symbolizer: new protomapsL.PolygonSymbolizer({ fill: 'rgba(200,200,200,0.45)', stroke: 'rgba(110,110,110,0.55)', width: 1.0 }),
    filter: function(zoom, feature) {
      var k   = String(feature.props[keyGeo] || '').trim();
      var row = joinMap.get(k);
      if (!row) return true;
      return !uniqueVals.includes(String(row[colorCol] || '').trim());
    }
  });

  layer.paintRules = rules;
  layer.rerenderTiles();
  setTimeout(function() { try { layer.redraw(); } catch(_) {} }, 50);

  /* 凡例表示 */
  var legendEl = document.getElementById('xlsxLegend');
  legendEl.innerHTML = '<div class="xl-leg-title">' + _esc(colorCol) + '</div>' +
    colorDefs.map(function(d) {
      return '<div class="xl-leg-item"><span class="xl-leg-sw" style="background:' + d.fill +
        ';border-color:' + d.stroke + '"></span>' + _esc(d.val) + '</div>';
    }).join('') +
    '<div class="xl-leg-item"><span class="xl-leg-sw" style="background:rgba(200,200,200,0.45);border-color:#aaa"></span>その他</div>';
  legendEl.style.display = '';
  _xlsxColorApplied = true;
}

/* ── PMTiles スタイル復元 ── */
function _restorePmTilesStyle() {
  var cfg = window.pmLayers && window.pmLayers[_xlsxTargetName];
  if (!cfg || !cfg._origPaintRules) return;
  cfg.layer.paintRules = cfg._origPaintRules;
  cfg.layer.rerenderTiles();
  delete cfg._origPaintRules;
  document.getElementById('xlsxLegend').style.display = 'none';
  _xlsxColorApplied = false;
}
