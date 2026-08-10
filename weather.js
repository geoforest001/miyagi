/* ============================================================
   weather.js  — 気象レイヤ (geoforest001/miyagi)
   気象庁 API  ©  akahanenoriaki
   ============================================================ */

const WIND_DIR = ['静穏','北北東','北東','東北東','東','東南東','南東','南南東',
                  '南','南南西','南西','西南西','西','西北西','北西','北北西','北'];

const WX_LAYER_DEFS = {
  rain: {type:'nowc', zoom:10, tf:['targetTimes_N1.json'], url:(bt,vt)=>`https://www.jma.go.jp/bosai/jmatile/data/nowc/${bt}/none/${vt}/surf/hrpns/{z}/{x}/{y}.png`},
};
const wxLayerState = {};
Object.keys(WX_LAYER_DEFS).forEach(k => { wxLayerState[k] = {on:false, layer:null, timer:null, errCount:0}; });
const WX_LBL_MAP = {rain:'lblLRain'};

let _amedasTable = null;
let amedasOn = false, amedasMarkers = [], amedasTimer = null;
const _rainAnim = {on:false, frames:[], idx:0, layer:null, frameTimer:null, refreshTimer:null};

/* ─── ユーティリティ ─────────────────────────── */
function jmaTime(intervalMin = 5, lagMin = 5) {
  const now = new Date();
  const totalMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const floored = Math.floor(totalMin / intervalMin) * intervalMin - lagMin;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, floored, 0));
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`;
}

async function rpFetch(url, opts) {
  const proxies = [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  for (const px of proxies) {
    try {
      const r = await fetch(px(url), opts || {});
      if (r.status !== 429 && r.status !== 403) return r;
    } catch {}
  }
  throw new Error('プロキシ接続失敗');
}

async function _jmaFetch(url, opts) {
  try {
    const r = await fetch(url, opts);
    if (r.ok) return r;
  } catch {}
  return rpFetch(url, opts);
}

async function getJmaValidTime(type, candidates) {
  for (const file of (candidates || ['targetTimes_N1.json'])) {
    try {
      const res = await _jmaFetch(`https://www.jma.go.jp/bosai/jmatile/data/${type}/${file}`);
      if (!res.ok) continue;
      const arr = await res.json();
      if (!Array.isArray(arr) || !arr.length) continue;
      const first = arr[0];
      if (typeof first === 'string') return {basetime: first, validtime: first, member: 'none'};
      const bt = first.basetime || first.time || '';
      const vt = first.validtime || bt;
      const member = first.member || 'none';
      if (bt) return {basetime: bt, validtime: vt, member};
    } catch(e) { console.warn('[getJmaValidTime]', e); }
  }
  return null;
}

/* ─── 気象タイルレイヤ ───────────────────────── */
async function wxUpdateLayer(key) {
  const def = WX_LAYER_DEFS[key], st = wxLayerState[key];
  if (!st.on) return;
  try {
    const times = await getJmaValidTime(def.type, def.tf);
    const t = jmaTime(5, 10);
    const urlTpl = times ? def.url(times.basetime, times.validtime) : def.url(t, t);
    if (st.layer) map.removeLayer(st.layer);
    st.errCount = 0;
    const lbl = document.getElementById(WX_LBL_MAP[key]);
    const lyr = L.tileLayer(urlTpl, {opacity:0.7, maxNativeZoom:def.zoom, maxZoom:22, attribution:'© 気象庁'});
    lyr.on('tileerror', () => {
      st.errCount++;
      if (st.errCount === 3 && lbl) lbl.style.borderColor = '#ff3b30';
    });
    lyr.on('tileload', () => { st.errCount = 0; if (lbl) lbl.style.borderColor = ''; });
    st.layer = lyr.addTo(map);
  } catch(e) { console.error('[wxUpdateLayer]', key, e); }
}

async function wxApplyLayerState(key) {
  try {
    const st = wxLayerState[key];
    const lbl = document.getElementById(WX_LBL_MAP[key]);
    if (lbl) lbl.classList.toggle('active', st.on);
    if (st.on) {
      await wxUpdateLayer(key);
      if (!st.timer) st.timer = setInterval(() => wxUpdateLayer(key), 5 * 60 * 1000);
    } else {
      clearInterval(st.timer); st.timer = null;
      if (st.layer) { map.removeLayer(st.layer); st.layer = null; }
    }
  } catch(e) { console.error('[wxApplyLayerState]', key, e); }
}

/* ─── AMeDASマーカーレイヤ ──────────────────── */
async function fetchAmedasMarkers() {
  try {
    const timeRes = await _jmaFetch('https://www.jma.go.jp/bosai/amedas/data/latest_time.txt');
    if (!timeRes.ok) throw new Error(`latest_time HTTP ${timeRes.status}`);
    const rawTime = (await timeRes.text()).trim();
    const m = rawTime.match(/(\d{4})\D(\d{2})\D(\d{2})\D(\d{2}):(\d{2}):(\d{2})/);
    if (!m) throw new Error('time parse failed');
    const timeStr = `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`;
    if (!_amedasTable) {
      const tRes = await _jmaFetch('https://www.jma.go.jp/bosai/amedas/const/amedastable.json');
      if (!tRes.ok) throw new Error(`amedastable HTTP ${tRes.status}`);
      _amedasTable = await tRes.json();
    }
    const dataRes = await _jmaFetch(`https://www.jma.go.jp/bosai/amedas/data/map/${timeStr}.json`);
    if (!dataRes.ok) throw new Error(`map data HTTP ${dataRes.status}`);
    const data = await dataRes.json();
    amedasMarkers.forEach(mk => map.removeLayer(mk)); amedasMarkers = [];
    const center = map.getCenter();
    const stations = Object.entries(data).map(([code, d]) => {
      const info = _amedasTable[code];
      if (!info || !info.lat || !info.lon || !Array.isArray(info.lat)) return null;
      const lat = info.lat[0] + info.lat[1] / 60, lng = info.lon[0] + info.lon[1] / 60;
      if (isNaN(lat) || isNaN(lng)) return null;
      return {code, info, d, lat, lng, dist: map.distance(center, L.latLng(lat, lng))};
    }).filter(s => s && s.dist < 60000).sort((a, b) => a.dist - b.dist).slice(0, 20);
    stations.forEach(s => {
      const tv = s.d.temp ? s.d.temp[0] : null;
      const temp = tv !== null ? `${tv}°C` : '--';
      const rain = s.d.precipitation1h ? `${s.d.precipitation1h[0]}mm/h` : (s.d.precipitation10m ? `${s.d.precipitation10m[0]}mm/10m` : '--');
      const wind = s.d.wind ? `${s.d.wind[0]}m/s` : '--';
      const col = tv === null ? '#888' : tv >= 30 ? '#c62828' : tv >= 25 ? '#e65100' : tv >= 15 ? '#1565c0' : tv >= 5 ? '#0277bd' : '#4a148c';
      const mk = L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          html: `<div style="background:#fff;color:${col};border:2px solid ${col};border-radius:6px;padding:2px 7px;font-size:13px;font-family:sans-serif;font-weight:bold;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.25)">${temp}</div>`,
          className: '', iconAnchor: [22, 12]
        })
      }).addTo(map);
      mk.bindPopup(`<div style="font-size:12px;font-family:sans-serif"><b>📡 ${s.info.kjName || s.code}</b><br>🌡 ${temp}　🌧 ${rain}　💨 ${wind}</div>`);
      amedasMarkers.push(mk);
    });
    const lbl = document.getElementById('lblLAmedas');
    if (lbl) lbl.style.borderColor = '';
  } catch(e) {
    console.error('[AMeDAS marker]', e);
    const lbl = document.getElementById('lblLAmedas');
    if (lbl) lbl.style.borderColor = '#ff3b30';
  }
}

/* ─── 雨雲アニメーション ─────────────────────── */
function _parseJmaTime(t) {
  if (!t || t.length < 12) return 0;
  return Date.UTC(+t.slice(0,4),+t.slice(4,6)-1,+t.slice(6,8),+t.slice(8,10),+t.slice(10,12));
}

async function _startRainAnim() {
  const status = document.getElementById('rainAnimStatus');
  const lbl = document.getElementById('lblLRainAnim');
  if (status) { status.textContent = '🌀 取得中...'; status.style.display = 'block'; }
  try {
    const res = await _jmaFetch('https://www.jma.go.jp/bosai/jmatile/data/rasrf/targetTimes.json',{cache:'no-store'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr.length) throw new Error('フレームなし');
    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const nowMs = Date.now() + JST_OFFSET;
    const byVt = {};
    for (const e of arr) {
      const vtMs = _parseJmaTime(e.validtime);
      if (vtMs >= nowMs - 3 * 3600000 && vtMs <= nowMs + 6 * 3600000) {
        if (!byVt[e.validtime] || e.basetime > byVt[e.validtime].basetime) byVt[e.validtime] = e;
      }
    }
    const frames = Object.values(byVt)
      .sort((a, b) => _parseJmaTime(a.validtime) - _parseJmaTime(b.validtime))
      .map(e => ({bt: e.basetime, vt: e.validtime}));
    if (!frames.length) throw new Error('フレームなし');
    _rainAnim.frames = frames; _rainAnim.nowMs = nowMs; _rainAnim.idx = 0;
    clearInterval(_rainAnim.frameTimer);
    _rainAnim.frameTimer = setInterval(_stepRainAnim, 1200);
    _stepRainAnim();
    if (lbl) lbl.style.borderColor = '';
  } catch(e) {
    console.error('[RainAnim]', e);
    if (status) status.textContent = '❌ 雨雲取得失敗';
    if (lbl) lbl.style.borderColor = '#ff3b30';
  }
}

function _stepRainAnim() {
  if (!_rainAnim.on || !_rainAnim.frames.length) return;
  const {bt, vt} = _rainAnim.frames[_rainAnim.idx];
  const newLayer = L.tileLayer(
    `https://www.jma.go.jp/bosai/jmatile/data/rasrf/${bt}/none/${vt}/surf/rasrf/{z}/{x}/{y}.png`,
    {opacity:0.65, maxNativeZoom:10, maxZoom:22, attribution:'© 気象庁'}
  );
  newLayer.addTo(map);
  if (_rainAnim.layer) map.removeLayer(_rainAnim.layer);
  _rainAnim.layer = newLayer;
  const status = document.getElementById('rainAnimStatus');
  if (status) {
    const vtMs = _parseJmaTime(vt);
    const diffMin = Math.round((vtMs - (_rainAnim.nowMs || Date.now())) / 60000);
    const hhmm = `${vt.slice(8,10)}:${vt.slice(10,12)}`;
    status.textContent = diffMin <= 0
      ? `🌀 ${hhmm} (${Math.abs(diffMin)}分前)`
      : `🌀 ${hhmm} (+${diffMin}分 予測)`;
    status.style.color = diffMin <= 0 ? '#aaa' : '#7ec8e3';
  }
  _rainAnim.idx = (_rainAnim.idx + 1) % _rainAnim.frames.length;
}

function _stopRainAnim() {
  clearInterval(_rainAnim.frameTimer); _rainAnim.frameTimer = null;
  clearInterval(_rainAnim.refreshTimer); _rainAnim.refreshTimer = null;
  if (_rainAnim.layer) { map.removeLayer(_rainAnim.layer); _rainAnim.layer = null; }
  _rainAnim.frames = []; _rainAnim.idx = 0;
  const status = document.getElementById('rainAnimStatus');
  if (status) status.style.display = 'none';
}

/* ─── 初期化 ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  function injectWeatherCheckbox() {
    const overlays = document.querySelector('.leaflet-control-layers-overlays');
    if (!overlays) { setTimeout(injectWeatherCheckbox, 150); return; }
    if (document.getElementById('wxLayerLabel')) return;

    const sep = document.createElement('div');
    sep.className = 'leaflet-control-layers-separator';
    overlays.appendChild(sep);
    const lbl = document.createElement('div');
    lbl.id = 'wxLayerLabel'; lbl.className = 'lc-section-label'; lbl.textContent = '気象レイヤ';
    overlays.appendChild(lbl);

    const wxDiv = document.createElement('div');
    wxDiv.id = 'wxLayers';
    wxDiv.innerHTML = `
      <label class="wx-chk-item" id="lblLRain"><input type="checkbox" id="chkLRain"><span class="ico">🌧</span><span>レーダー雨量</span></label>
      <label class="wx-chk-item" id="lblLRainAnim"><input type="checkbox" id="chkLRainAnim"><span class="ico">🌀</span><span>雨雲の動き</span></label>
      <label class="wx-chk-item" id="lblLAmedas"><input type="checkbox" id="chkLAmedas"><span class="ico">📡</span><span>アメダス</span></label>
    `;
    overlays.appendChild(wxDiv);

    if (!document.getElementById('rainAnimStatus')) {
      const bar = document.createElement('div');
      bar.id = 'rainAnimStatus';
      bar.style.cssText = 'display:none;position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:1000;background:rgba(0,0,0,0.65);color:#fff;padding:5px 16px;border-radius:20px;font-size:13px;pointer-events:none;white-space:nowrap;';
      map.getContainer().appendChild(bar);
    }

    document.getElementById('chkLRain').addEventListener('change', function() {
      wxLayerState['rain'].on = this.checked;
      wxApplyLayerState('rain');
    });
    document.getElementById('chkLRainAnim').addEventListener('change', function() {
      _rainAnim.on = this.checked;
      document.getElementById('lblLRainAnim').classList.toggle('active', _rainAnim.on);
      if (_rainAnim.on) {
        _startRainAnim();
        if (!_rainAnim.refreshTimer) _rainAnim.refreshTimer = setInterval(_startRainAnim, 10 * 60 * 1000);
      } else {
        _stopRainAnim();
      }
    });
    document.getElementById('chkLAmedas').addEventListener('change', function() {
      amedasOn = this.checked;
      document.getElementById('lblLAmedas').classList.toggle('active', amedasOn);
      if (amedasOn) {
        fetchAmedasMarkers();
        amedasTimer = setInterval(fetchAmedasMarkers, 10 * 60 * 1000);
      } else {
        clearInterval(amedasTimer); amedasTimer = null;
        amedasMarkers.forEach(mk => map.removeLayer(mk)); amedasMarkers = [];
      }
    });
  }
  injectWeatherCheckbox();
});
