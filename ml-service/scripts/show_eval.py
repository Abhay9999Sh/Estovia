import json
import sys
from pathlib import Path

p = Path(sys.argv[1] if len(sys.argv) > 1 else "artifacts/evaluation_builtup.json")
r = json.loads(p.read_text(encoding="utf-8"))
print("segment           :", r["segment"])
print("selected model    :", r["selected_model"])
print("beats baseline    :", r["beats_locality_median_baseline"])
print("observations      :", r["observations"])
print("split             :", r["split"]["kind"], "|", r["split"]["test_description"])
print("temporal          :", r["split"]["temporal_validation"]["status"])
print("unseen locality   :", round(r["unseen_locality_share"] * 100, 2), "%")
print()
hdr = f"{'model':<34}{'n':>6}{'medAPE':>9}{'MAPE':>9}{'WAPE':>8}{'MAE':>15}{'RMSE':>15}{'R2':>8}{'cover':>8}"
print(hdr)
print("-" * len(hdr))
for k, v in r["metrics"].items():
    print(
        f"{k:<34}{v['n']:>6}{v['median_ape_pct']:>8.2f}%{v['mape_pct']:>8.2f}%"
        f"{v['wape_pct']:>7.2f}%{v['mae']:>15,.0f}{v['rmse']:>15,.0f}{v['r2']:>8.3f}"
        f"{v.get('interval_coverage_pct', float('nan')):>7.1f}%"
    )
print()
print("conformal:", json.dumps(r["conformal"], indent=1))
for grp in ("by_city", "by_category", "by_price_band", "by_area_band", "by_locality"):
    print(f"\n{grp}")
    for kk, vv in list(r["segment_metrics"][grp].items())[:14]:
        print(
            f"   {kk[:34]:<34} n={vv['n']:>5} medAPE={vv['median_ape_pct']:>7.2f}%"
            f" R2={vv['r2']:>6.3f} suff={vv['sufficient']}"
        )
