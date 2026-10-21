#!/usr/bin/env python3
"""
GLCL Targeted Missing Runner Recovery Tool
Scans ONLY the unassigned photos in a given fixture's album using the enhanced
glcl-tagger (with 7-digit bib support, relaxed short-bib confidence, and lowered sharpness threshold).
"""

import sys
import os
import json
import ssl
import urllib.request
import subprocess
import argparse
import shutil
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image, ImageFilter, ImageStat

INDEX_FILE = Path("assets/data/photo_tags.json")
BACKUP_FILE = Path("assets/data/photo_tags.backup.json")
TAGGER_BIN = Path("backend_tools/glcl-tagger").resolve() if Path("backend_tools/glcl-tagger").exists() else Path("./glcl-tagger").resolve()
ALBUM_MAP_FILE = Path("assets/data/fixture_photo_albums.json")
DATA_JS_FILE = Path("data.js")

ssl_ctx = ssl._create_unverified_context()
ssl._create_default_https_context = ssl._create_unverified_context
opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx))
opener.addheaders = [("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")]
urllib.request.install_opener(opener)

def calculate_subject_sharpness(img_path):
    try:
        im = Image.open(img_path).convert("L")
        kernel = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1, offset=128)
        edges = im.filter(kernel)
        w, h = im.size
        grid_w, grid_h = w // 4, h // 4
        max_var = 0.0
        for r in range(4):
            for c in range(4):
                box = (c * grid_w, r * grid_h, (c + 1) * grid_w, (r + 1) * grid_h)
                tile = edges.crop(box)
                var = ImageStat.Stat(tile).var[0]
                if var > max_var:
                    max_var = var
        return round(max_var, 1)
    except Exception:
        return 0.0

def load_fixture_data(album_id):
    # Load album metadata
    with open(ALBUM_MAP_FILE) as f:
        amap = json.load(f)
    info = amap.get(str(album_id)) or next((v for v in amap.values() if str(v.get("album_id")) == str(album_id)), None)
    if not info:
        raise ValueError(f"Album ID {album_id} not found in {ALBUM_MAP_FILE}")

    season = info.get("season")
    discipline = info.get("discipline")
    race_number = info.get("race_number")
    venue = info.get("venue", "")

    # Load official results from data.js
    with open(DATA_JS_FILE) as f:
        content = f.read()
    m = re.search(r'const\s+raceResults\s*=\s*(\[.*?\]);', content, re.DOTALL)
    if not m:
        s_idx = content.find('[')
        e_idx = content.rfind(']')
        all_results = json.loads(content[s_idx:e_idx+1])
    else:
        all_results = json.loads(m.group(1))

    finishers = [r for r in all_results if r.get("season") == season and r.get("discipline") == discipline and r.get("race_number") == race_number]
    return info, finishers

def recover_album(album_id, min_sharpness=140.0, min_conf=0.50, batch_size=250, max_unassigned=0):
    album_id = str(album_id)
    info, finishers = load_fixture_data(album_id)
    season = info.get("season")
    discipline = info.get("discipline")
    race_number = info.get("race_number")
    venue = info.get("venue", "")

    print("=" * 80)
    print(f"🎯 GLCL Targeted Missing Runner Recovery")
    print(f"Fixture:      {venue} — {discipline.upper()} Race #{race_number} ({season})")
    print(f"Album ID:     {album_id}")
    print(f"Min Sharp:    {min_sharpness} (relaxed from 250)")
    print(f"Min Conf:     {min_conf}")
    print("=" * 80)

    # Load photo tags
    with open(INDEX_FILE) as f:
        photo_tags = json.load(f)

    # Backup existing index
    shutil.copy2(INDEX_FILE, BACKUP_FILE)

    # Calculate initial coverage
    total_finishers = len(finishers)
    fixture_photos = [p for p in photo_tags.values() if str(p.get("album_id")) == album_id]
    
    initial_matched_finishers = set()
    for p in fixture_photos:
        if p.get("name"):
            initial_matched_finishers.add(p.get("name").strip().lower())
        for r in p.get("runners", []):
            if r.get("name"):
                initial_matched_finishers.add(r.get("name").strip().lower())

    init_cov_count = sum(1 for fin in finishers if fin.get("name", "").strip().lower() in initial_matched_finishers)
    init_cov_pct = (init_cov_count / total_finishers * 100) if total_finishers else 0
    missing_before = [fin for fin in finishers if fin.get("name", "").strip().lower() not in initial_matched_finishers]

    print(f"Initial Finishers Covered: {init_cov_count} / {total_finishers} ({init_cov_pct:.1f}%)")
    print(f"Finishers Missing Before:  {len(missing_before)}")

    # Identify unassigned photos
    unassigned_entries = []
    for pid, p in photo_tags.items():
        if str(p.get("album_id")) == album_id:
            has_runner = bool(p.get("name") or (p.get("runners") and len(p.get("runners")) > 0))
            if not has_runner:
                unassigned_entries.append((pid, p))

    print(f"Total Unassigned Photos to Re-Analyze: {len(unassigned_entries)}")
    if max_unassigned and max_unassigned > 0:
        unassigned_entries = unassigned_entries[:max_unassigned]
        print(f"Limited to first {len(unassigned_entries)} unassigned photos.")

    if not unassigned_entries:
        print("No unassigned photos to recover!")
        return

    # Prepare batches
    batches = [unassigned_entries[i:i + batch_size] for i in range(0, len(unassigned_entries), batch_size)]
    temp_dir = Path("/tmp/glcl_recovery_batch")

    newly_tagged_photos = 0
    newly_covered_finishers = set()

    missing_bib_lookup = {str(fin.get("bib", "")).strip(): fin for fin in missing_before if str(fin.get("bib", "")).strip() not in ["", "-", "0"]}
    all_bib_lookup = {str(fin.get("bib", "")).strip(): fin for fin in finishers if str(fin.get("bib", "")).strip() not in ["", "-", "0"]}

    for b_idx, batch in enumerate(batches, 1):
        print(f"\n📦 Batch {b_idx}/{len(batches)}: Downloading and scanning {len(batch)} unassigned photos...")
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        temp_dir.mkdir(parents=True, exist_ok=True)

        def dl_task(item):
            pid, p = item
            url = p.get("url_l") or p.get("url_m")
            if not url:
                return None
            target_path = temp_dir / f"photo_{pid}.jpg"
            for _ in range(2):
                try:
                    urllib.request.urlretrieve(url, target_path)
                    return (pid, target_path)
                except Exception:
                    pass
            return None

        downloaded_items = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(dl_task, item) for item in batch]
            for f in as_completed(futures):
                res = f.result()
                if res:
                    downloaded_items.append(res)
                print(f"  [{len(downloaded_items)}/{len(batch)}] Previews downloaded", end="\r")

        print(f"\nDownloaded {len(downloaded_items)} previews. Running enhanced glcl-tagger...")

        # Run enhanced tagger
        cmd = [
            str(TAGGER_BIN),
            str(temp_dir),
            "--season", season,
            "--discipline", discipline,
            "--race", str(race_number),
            "--min-conf", str(min_conf),
            "--json"
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)

        batch_new_tags = 0
        photo_dict = {pid: p for pid, p in batch}

        for raw_line in proc.stdout.splitlines():
            raw_line = raw_line.strip()
            if not (raw_line.startswith("{") and raw_line.endswith("}")):
                continue
            try:
                res = json.loads(raw_line)
            except Exception:
                continue

            photo_fn = res.get("photo", "")
            if "photo_" not in photo_fn:
                continue
            pid = photo_fn.replace("photo_", "").split(".")[0]
            matches = res.get("matches", [])
            if not matches or pid not in photo_dict:
                continue

            # Check sharpness
            temp_img = temp_dir / f"photo_{pid}.jpg"
            sharpness = calculate_subject_sharpness(temp_img) if temp_img.exists() else 0.0

            # Filter valid matches: accept if sharpness >= min_sharpness OR if match is one of the missing finishers!
            valid_runners = []
            for m in matches:
                bib = str(m.get("bib", "")).strip()
                if bib in all_bib_lookup:
                    fin = all_bib_lookup[bib]
                    is_missing = (bib in missing_bib_lookup)
                    # Relax sharpness threshold for verified missing finishers down to 100
                    effective_min_sharp = 100.0 if is_missing else min_sharpness
                    if sharpness >= effective_min_sharp or min_sharpness == 0:
                        valid_runners.append({
                            "bib": bib,
                            "name": fin.get("name", ""),
                            "club": fin.get("club", "")
                        })

            if valid_runners:
                primary = valid_runners[0]
                entry = photo_dict[pid]
                entry["bib"] = primary["bib"]
                entry["name"] = primary["name"]
                entry["club"] = primary["club"]
                entry["runners"] = valid_runners
                entry["sharpness"] = sharpness
                photo_tags[pid] = entry
                batch_new_tags += 1
                newly_tagged_photos += 1

                for vr in valid_runners:
                    fn_lower = vr["name"].strip().lower()
                    if fn_lower not in initial_matched_finishers:
                        newly_covered_finishers.add(vr["name"])

                r_str = ", ".join([f"Bib #{r['bib']} ({r['name']})" for r in valid_runners])
                print(f"  ✨ RECOVERED photo {pid} → {r_str} [Sharpness: {sharpness}]")

        shutil.rmtree(temp_dir, ignore_errors=True)

        # Save checkpoint to disk
        with open(INDEX_FILE, "w") as f:
            json.dump(photo_tags, f, indent=2)

        print(f"💾 Checkpoint saved. {batch_new_tags} photos recovered in this batch. Total recovered so far: {newly_tagged_photos}")

    # Run full reconciliation to ground and finalize
    try:
        from reconcile_photo_tags import load_data, build_fixture_indices, reconcile
        pt, am, gr, ov = load_data(source_path=INDEX_FILE)
        i2f, fr = build_fixture_indices(am, gr)
        reconcile(pt, i2f, fr, overrides=ov, apply_changes=True)
    except Exception as re_err:
        print(f"Reconciliation note: {re_err}")

    # Re-calculate final coverage
    with open(INDEX_FILE) as f:
        final_tags = json.load(f)

    final_fixture_photos = [p for p in final_tags.values() if str(p.get("album_id")) == album_id]
    final_matched = set()
    for p in final_fixture_photos:
        if p.get("name"):
            final_matched.add(p.get("name").strip().lower())
        for r in p.get("runners", []):
            if r.get("name"):
                final_matched.add(r.get("name").strip().lower())

    final_cov_count = sum(1 for fin in finishers if fin.get("name", "").strip().lower() in final_matched)
    final_cov_pct = (final_cov_count / total_finishers * 100) if total_finishers else 0

    print("\n" + "=" * 80)
    print("🏁 RECOVERY SCAN COMPLETE")
    print(f"Newly Tagged Photos:          +{newly_tagged_photos}")
    print(f"Newly Recovered Finishers:    +{len(newly_covered_finishers)}")
    if newly_covered_finishers:
        for name in sorted(newly_covered_finishers):
            print(f"  ⭐ {name}")
    print("-" * 80)
    print(f"Finishers Covered Before:     {init_cov_count} / {total_finishers} ({init_cov_pct:.1f}%)")
    print(f"Finishers Covered Now:        {final_cov_count} / {total_finishers} ({final_cov_pct:.1f}%)")
    print(f"Net Gain:                     +{final_cov_count - init_cov_count} finishers ({final_cov_pct - init_cov_pct:+.1f}%)")
    print("=" * 80)

def main():
    parser = argparse.ArgumentParser(description="Targeted recovery for missing GLCL runners")
    parser.add_argument("album_id", help="Flickr Album ID (e.g. 72177720334996716)")
    parser.add_argument("--min-sharpness", type=float, default=140.0, help="Minimum sharpness (default 140)")
    parser.add_argument("--min-conf", type=float, default=0.50, help="Minimum OCR confidence (default 0.50)")
    parser.add_argument("--batch-size", type=int, default=250, help="Batch size (default 250)")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of unassigned photos to scan (0 = all)")
    args = parser.parse_args()

    recover_album(
        args.album_id,
        min_sharpness=args.min_sharpness,
        min_conf=args.min_conf,
        batch_size=args.batch_size,
        max_unassigned=args.limit
    )

if __name__ == "__main__":
    main()
