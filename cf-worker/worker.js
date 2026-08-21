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
const ROUTES = {
  '/keikakuzu/': 'KEIKAKUZU2026',   // 林班・準林班・林小班
  '/shudaizu/'  : 'SHUDAIZU2026',   // 樹種・林種・林齢
  '/minyurin/'  : 'MINYURIN2026',   // 民有林
  '/hoanrin/'   : 'HOANRIN2026',    // 保安林
  '/sugibatsu/' : 'SUGIBATSU2026',  // スギ人工林・伐採
  '/disaster/'  : 'DISASTER',       // 山地災害危険地区
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS プリフライト
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // GET のみ許可
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // ルート解決
    let azurePath = null;
    for (const [prefix, azureDir] of Object.entries(ROUTES)) {
      if (url.pathname.startsWith(prefix)) {
        azurePath = `/${azureDir}/${url.pathname.slice(prefix.length)}`;
        break;
      }
    }

    if (!azurePath) {
      return new Response('Not Found', { status: 404 });
    }

    const targetUrl = `${AZURE_BASE}${azurePath}`;

    try {
      const resp = await fetch(targetUrl);
      const body = resp.ok ? resp.body : null;

      return new Response(body, {
        status: resp.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': resp.headers.get('Content-Type') ?? 'application/x-protobuf',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      return new Response('Upstream Error', { status: 502 });
    }
  },
};
