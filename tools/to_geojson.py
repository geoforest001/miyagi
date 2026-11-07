#!/usr/bin/env python3
"""
PBF タイル → GeoJSON 変換

使い方:
  pip install mapbox-vector-tile   # 初回のみ

  python3 to_geojson.py                        # サンプル（大河原 z13）
  python3 to_geojson.py --region 大河原        # 地域単位
  python3 to_geojson.py --all-regions          # 全地域一括
  python3 to_geojson.py --zoom 14 --region 仙台

地域: 大河原 / 仙台 / 北部 / 栗原 / 東部 / 登米 / 気仙沼
"""

import sys, math, json, urllib.request, argparse
from pathlib import Path

try:
    import mapbox_vector_tile
except ImportError:
    print("pip install mapbox-vector-tile")
    sys.exit(1)

AZURE_BASE = "https://mygstrg.blob.core.windows.net/map"
DATASETS = {
    "KEIKAKUZU": "KEIKAKUZU2026",
    "SHUDAIZU" : "SHUDAIZU2026",
    "MINYURIN" : "MINYURIN2026",
    "HOANRIN"  : "HOANRIN2026",
}

REGIONS = {
    "大河原": (140.40, 37.77, 141.05, 38.22),
    "仙台"  : (140.65, 38.10, 141.35, 38.55),
    "北部"  : (140.50, 38.40, 141.25, 39.00),
    "栗原"  : (140.60, 38.55, 141.25, 39.00),
    "東部"  : (141.00, 38.30, 141.70, 38.82),
    "登米"  : (140.90, 38.55, 141.55, 38.90),
    "気仙沼": (141.20, 38.60, 141.70, 39.00),
}

DEFAULT_BBOX = (140.52, 37.92, 140.78, 38.08)

def lon2x(lon, z): return int((lon + 180) / 360 * 2**z)
def lat2y(lat, z):
    r = math.radians(lat)
    return int((1 - math.log(math.tan(r) + 1/math.cos(r)) / math.pi) / 2 * 2**z)

EARTH_C = 40075016.68415

def make_transformer(tx, ty, z, extent=4096):
    n = 2 ** z
    tile_m = EARTH_C / n
    mx_w = tx * tile_m - EARTH_C / 2
    my_n = EARTH_C / 2 - ty * tile_m
    def transform(px, py):
        mx = mx_w + (px / extent) * tile_m
        my = my_n - (py / extent) * tile_m
        lon = math.degrees(mx / 6378137.0)
        lat = math.degrees(2 * math.atan(math.exp(my / 6378137.0)) - math.pi / 2)
        return lon, lat
    return transform

def fetch_tile(dataset_dir, z, x, y):
    url = f"{AZURE_BASE}/{dataset_dir}/{z}/{x}/{y}.pbf"
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            data = r.read()
        return data if data else None
    except Exception as e:
        print(f"  スキップ {z}/{x}/{y}: {e}")
        return None

def convert_bbox(bbox_tuple, z, dataset_key, label, layer_filter=None):
    lon_w, lat_s, lon_e, lat_n = bbox_tuple
    dataset_dir = DATASETS[dataset_key]
    x0, x1 = lon2x(lon_w, z), lon2x(lon_e, z)
    y0, y1 = lat2y(lat_n, z), lat2y(lat_s, z)
    total = (x1 - x0 + 1) * (y1 - y0 + 1)
    print(f"\n{label} [{dataset_key} z{z}] {total} タイル処理中...")

    all_features = {}
    layer_attrs  = {}

    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            data = fetch_tile(dataset_dir, z, x, y)
            if not data:
                continue
            tf = make_transformer(x, y, z)
            decoded = mapbox_vector_tile.decode(data, transformer=tf)
            for lname, layer in decoded.items():
                if layer_filter and lname != layer_filter:
                    continue
                if lname not in all_features:
                    all_features[lname] = []
                    layer_attrs[lname] = set()
                for feat in layer.get("features", []):
                    all_features[lname].append(feat)
                    layer_attrs[lname].update(feat.get("properties", {}).keys())

    if not all_features:
        print("  フィーチャーなし（エリア外または404）")
        return

    print("  レイヤ:")
    for lname, feats in all_features.items():
        print(f"    {lname}: {len(feats)} フィーチャー  属性: {sorted(layer_attrs[lname])}")

    merged = []
    for lname, feats in all_features.items():
        for f in feats:
            f.setdefault("properties", {})["_layer"] = lname
            merged.append(f)

    safe_label = label.replace("/", "_")
    out_name = f"{safe_label}_{dataset_key}_z{z}.geojson"
    out_path = Path(__file__).parent / out_name
    out_path.write_text(
        json.dumps({"type": "FeatureCollection", "features": merged},
                   ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"  → {out_path}  ({len(merged)} フィーチャー)")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zoom", type=int, default=13)
    ap.add_argument("--bbox", default=None, help="lon_w,lat_s,lon_e,lat_n")
    ap.add_argument("--region", default=None, choices=list(REGIONS))
    ap.add_argument("--all-regions", action="store_true")
    ap.add_argument("--dataset", default="KEIKAKUZU", choices=list(DATASETS))
    ap.add_argument("--layer", default=None)
    args = ap.parse_args()

    if args.all_regions:
        for name, bbox in REGIONS.items():
            convert_bbox(bbox, args.zoom, args.dataset, name, args.layer)
    elif args.region:
        convert_bbox(REGIONS[args.region], args.zoom, args.dataset, args.region, args.layer)
    elif args.bbox:
        parts = tuple(float(v) for v in args.bbox.split(","))
        convert_bbox(parts, args.zoom, args.dataset, "custom", args.layer)
    else:
        convert_bbox(DEFAULT_BBOX, args.zoom, args.dataset, "sample", args.layer)

main()
