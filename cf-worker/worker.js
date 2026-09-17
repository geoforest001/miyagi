/**
 * Cloudflare Worker — 宮城県森林情報 CORS プロキシ
 *
 * Azure Blob Storage の PBF タイルに CORS ヘッダーを付けて中継する。
 * 無料プラン: 100,000 リクエスト/日
 *
 * デプロイ手順:
 *   1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. このコードを貼り付けて Deploy
 *   3. 割り当てられた *.workers.dev URL を控える
 *   4. main.js の FGIS_WORKER_URL をそのURLに書き換える
 */

const AZURE_BASE = 'https://mygstrg.blob.core.windows.net/map';

// パスプレフィックス → Azure Blob のパス名
const AZURE_ROUTES = {
  '/keikakuzu/': 'KEIKAKUZU2026',   // 林班・準林班・林小班
  '/shudaizu/'  : 'SHUDAIZU2026',   // 樹種・林種・林齢
  '/minyurin/'  : 'MINYURIN2026',   // 民有林
  '/hoanrin/'   : 'HOANRIN2026',    // 保安林
  '/sugibatsu/' : 'SUGIBATSU2026',  // スギ人工林・伐採
  '/disaster/'  : 'DISASTER',       // 山地災害危険地区
};

// 外部タイルサーバー（CORS プロキシ）
const PROXY_ROUTES = {
  '/rinya/': 'https://rinya-tiles.geospatial.jp/fr_mesh20m_pbf_2025/', // 全国森林資源メッシュ（林野庁）
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS プリフライト
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // GET のみ許可
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let targetUrl = null;

    // 外部プロキシルート
    for (const [prefix, base] of Object.entries(PROXY_ROUTES)) {
      if (url.pathname.startsWith(prefix)) {
        targetUrl = base + url.pathname.slice(prefix.length);
        break;
      }
    }

    // Azure Blob ルート
    if (!targetUrl) {
      for (const [prefix, azureDir] of Object.entries(AZURE_ROUTES)) {
        if (url.pathname.startsWith(prefix)) {
          targetUrl = `${AZURE_BASE}/${azureDir}/${url.pathname.slice(prefix.length)}`;
          break;
        }
      }
    }

    if (!targetUrl) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const resp = await fetch(targetUrl);
      const body = resp.ok ? resp.body : null;

      return new Response(body, {
        status: resp.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': resp.headers.get('Content-Type') ?? 'application/x-protobuf',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      return new Response('Upstream Error', { status: 502 });
    }
  },
};
