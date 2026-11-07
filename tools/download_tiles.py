#!/usr/bin/env python3
"""
宮城県森林情報 PBF タイル一括ダウンロードスクリプト

使い方:
  python3 download_tiles.py count           # タイル数・推定サイズを確認
  python3 download_tiles.py all             # 宮城県全域をダウンロード
  python3 download_tiles.py region 大河原   # 地域単位でダウンロード

ダウンロード後の PMTiles 変換:
  brew install pmtiles          # go-pmtiles インストール
  python3 make_pmtiles.py       # このフォルダの make_pmtiles.py を実行

注意:
  全域 z12-15 は推定 5〜8 万タイル / 500MB〜1GB。
  まず count で確認してから実行を。
"""

import os
import math
import time
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# ─────────────────────────────────────────────
# 設定
# ─────────────────────────────────────────────
DATASETS = {
    "KEIKAKUZU": "KEIKAKUZU2026",  # 林班・準林班・林小班（メイン）
    "SHUDAIZU" : "SHUDAIZU2026",   # 樹種・林種・林齢
    "MINYURIN" : "MINYURIN2026",   # 民有林
    "HOANRIN"  : "HOANRIN2026",    # 保安林
}
AZURE_BASE = "https://mygstrg.blob.core.windows.net/map"
OUTPUT_DIR = Path(__file__).parent / "tiles"
ZOOM_MIN, ZOOM_MAX = 12, 15
WORKERS = 8          # 並列ダウンロード数
SLEEP_PER_REQ = 0.02 # サーバー負荷軽減（秒）

# ─────────────────────────────────────────────
# 宮城県 全体 bbox
# ─────────────────────────────────────────────
MIYAGI = dict(w=140.27, e=141.69, s=37.77, n=39.00)

# ─────────────────────────────────────────────
# 地域別 bbox（地方振興事務所単位）
# ─────────────────────────────────────────────
REGIONS = {
    "大河原": dict(w=140.40, e=141.05, s=37.77, n=38.22),
    "仙台"  : dict(w=140.65, e=141.35, s=38.10, n=38.55),
    "北部"  : dict(w=140.50, e=141.25, s=38.40, n=39.00),
    "栗原"  : dict(w=140.60, e=141.25, s=38.55, n=39.00),
    "東部"  : dict(w=141.00, e=141.70, s=38.30, n=38.82),
    "登米"  : dict(w=140.90, e=141.55, s=38.55, n=38.90),
    "気仙沼": dict(w=141.20, e=141.70, s=38.60, n=39.00),
}

# ─────────────────────────────────────────────
# タイル座標計算
# ─────────────────────────────────────────────
def lon2x(lon, z): return int((lon + 180) / 360 * 2**z)
def lat2y(lat, z):
    r = math.radians(lat)
    return int((1 - math.log(math.tan(r) + 1/math.cos(r)) / math.pi) / 2 * 2**z)

def bbox_tiles(bbox, z):
    x0 = lon2x(bbox["w"], z);  x1 = lon2x(bbox["e"], z)
    y0 = lat2y(bbox["n"], z);  y1 = lat2y(bbox["s"], z)  # y0 < y1
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            yield z, x, y

def count_tiles(bbox):
    return sum(1 for z in range(ZOOM_MIN, ZOOM_MAX+1) for _ in bbox_tiles(bbox, z))

# ─────────────────────────────────────────────
# ダウンロード
# ─────────────────────────────────────────────
def download_one(args):
    dataset_key, dataset_dir, z, x, y = args
    out = OUTPUT_DIR / dataset_key / str(z) / str(x) / f"{y}.pbf"
    if out.exists():
        return "skip"
    url = f"{AZURE_BASE}/{dataset_dir}/{z}/{x}/{y}.pbf"
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = resp.read()
        if len(data) > 0:
            out.write_bytes(data)
            return "ok"
        else:
            return "empty"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "404"
        return f"err{e.code}"
    except Exception as e:
        return f"err:{e}"

def download_bbox(bbox, dataset_key="KEIKAKUZU", label=""):
    dataset_dir = DATASETS[dataset_key]
    tasks = []
    for z in range(ZOOM_MIN, ZOOM_MAX + 1):
        for tz, x, y in bbox_tiles(bbox, z):
            tasks.append((dataset_key, dataset_dir, tz, x, y))

    total = len(tasks)
    print(f"\n{label} [{dataset_key}] {total:,} タイルをダウンロード開始...")

    counts = {"ok": 0, "skip": 0, "404": 0, "empty": 0, "err": 0}
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(download_one, t): t for t in tasks}
        for i, f in enumerate(as_completed(futures), 1):
            r = f.result()
            if r == "ok":     counts["ok"] += 1
            elif r == "skip": counts["skip"] += 1
            elif r == "404":  counts["404"] += 1
            elif r == "empty":counts["empty"] += 1
            else:             counts["err"] += 1
            if i % 200 == 0 or i == total:
                print(f"  {i:,}/{total:,}  取得:{counts['ok']} スキップ:{counts['skip']} "
                      f"404:{counts['404']} エラー:{counts['err']}")
            time.sleep(SLEEP_PER_REQ / WORKERS)

    print(f"完了: {label} [{dataset_key}]  "
          f"取得:{counts['ok']} スキップ:{counts['skip']} 404:{counts['404']} エラー:{counts['err']}")

# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    mode = sys.argv[1] if len(sys.argv) > 1 else "count"

    if mode == "count":
        print("=== タイル数・推定サイズ ===")
        total = count_tiles(MIYAGI)
        print(f"\n宮城県全域 (z{ZOOM_MIN}-{ZOOM_MAX}): {total:,} タイル")
        print(f"  推定サイズ: {total * 12 // 1024} MB〜{total * 20 // 1024} MB")
        print("\n地域別:")
        for name, bbox in REGIONS.items():
            n = count_tiles(bbox)
            print(f"  {name}: {n:,} タイル  (~{n*12//1024}〜{n*20//1024} MB)")

    elif mode == "all":
        dataset = sys.argv[2] if len(sys.argv) > 2 else "KEIKAKUZU"
        download_bbox(MIYAGI, dataset, "宮城県全域")

    elif mode == "region":
        if len(sys.argv) < 3:
            print(f"地域名を指定: {', '.join(REGIONS)}")
            sys.exit(1)
        name = sys.argv[2]
        dataset = sys.argv[3] if len(sys.argv) > 3 else "KEIKAKUZU"
        if name not in REGIONS:
            print(f"不明な地域: {name}  選択肢: {', '.join(REGIONS)}")
            sys.exit(1)
        download_bbox(REGIONS[name], dataset, name)

    elif mode == "all-regions":
        dataset = sys.argv[2] if len(sys.argv) > 2 else "KEIKAKUZU"
        for name, bbox in REGIONS.items():
            download_bbox(bbox, dataset, name)

    else:
        print(__doc__)
