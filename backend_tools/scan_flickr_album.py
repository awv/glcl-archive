#!/usr/bin/env python3
"""
GLCL Flickr Album Auto-Indexer (Fast Batching)
Streams photos directly from a Flickr album, detects bib numbers using Apple Vision Neural Engine,
and stores the tag mappings in assets/data/photo_tags.json for instant search on photos.html.
Requires zero local storage and no re-uploading!
"""

import sys
import os
import json
import ssl
import urllib.request
import subprocess
import argparse
from pathlib import Path
import shutil
from PIL import Image, ImageFilter, ImageStat

FLICKR_API_KEY = os.environ.get("FLICKR_API_KEY", "")
if not FLICKR_API_KEY:
    cfg = Path(__file__).parent / "config.json"
    if cfg.exists():
        try:
            with open(cfg) as f:
                FLICKR_API_KEY = json.load(f).get("FLICKR_API_KEY", "")
        except Exception:
            pass
if not FLICKR_API_KEY:
    raise RuntimeError("FLICKR_API_KEY not set. Please set FLICKR_API_KEY environment variable or populate backend_tools/config.json.")

INDEX_FILE = Path("assets/data/photo_tags.json")
TAGGER_BIN = Path("backend_tools/glcl-tagger")

ssl._create_default_https_context = ssl._create_unverified_context

def calculate_subject_sharpness(img_path):
    """
    Computes localized subject sharpness using Laplacian edge variance.
    Divides the frame into a 4x4 grid (16 tiles) and returns the maximum tile sharpness.
    This protects intentional artistic bokeh (e.g. blurry foreground rocks/crowds or creamy backgrounds)
    while catching genuine motion blur or missed focus on the subject.
    """
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

def fetch_album_photos(photoset_id, max_photos=50):
    photos = []
    page = 1
    # Maximize page size (Flickr allows up to 500 per call) to minimize API query quota
    per_page = min(max_photos, 500) if (max_photos and max_photos > 0) else 500
    
    while True:
        if max_photos and max_photos > 0 and len(photos) >= max_photos:
            break
        url = (
            f"https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos"
            f"&api_key={FLICKR_API_KEY}&photoset_id={photoset_id}"
            f"&extras=url_m,url_l,url_h,url_k,url_3k,url_4k,tags&per_page={per_page}&page={page}&format=json&nojsoncallback=1"
        )
        try:
            req = urllib.request.urlopen(url, timeout=15)
            data = json.loads(req.read().decode('utf-8'))
        except Exception as e:
            print(f"Error fetching album metadata: {e}")
            break
        
        photoset = data.get("photoset", {})
        batch = photoset.get("photo", [])
        if not batch:
            break
            
        photos.extend(batch)
        total_pages = int(photoset.get("pages", 1))
        if page >= total_pages:
            break
        page += 1

    return photos if (not max_photos or max_photos <= 0) else photos[:max_photos]

def extract_album_id(val):
    if not val:
        return ""
    val = str(val).strip().rstrip("/")
    if "/" in val:
        val = val.split("/")[-1]
    return val

def scan_album(album_id, season="2024/2025", limit=30, index_file=INDEX_FILE, min_sharpness=250):
    album_id = extract_album_id(album_id)
    if not TAGGER_BIN.exists():
        print("Error: backend_tools/glcl-tagger binary not found. Please compile it first.")
        return 0, 0

    index_file = Path(index_file)
    index_file.parent.mkdir(parents=True, exist_ok=True)
    existing_index = {}
    if index_file.exists():
        try:
            with open(index_file, "r") as f:
                existing_index = json.load(f)
        except Exception:
            existing_index = {}

    print(f"=================================================================")
    print(f"📸 Streaming Flickr Album: {album_id} (Limit: {limit} photos)")
    print(f"Season: {season} | Min Subject Sharpness: {min_sharpness}")
    print(f"=================================================================")

    photos = fetch_album_photos(album_id, max_photos=limit)
    print(f"Fetched {len(photos)} photos from Flickr album metadata.")

    temp_dir = Path("/tmp/glcl_flickr_batch")
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    to_download = []
    for p in photos:
        pid = str(p["id"])
        if pid not in existing_index:
            to_download.append(p)

    print(f"Photos to analyze: {len(to_download)} (Already indexed: {len(photos) - len(to_download)})\n")

    if not to_download:
        print("All requested photos already indexed!")
        return 0, len(existing_index)

    print("Downloading preview thumbnails from Flickr CDN (parallel)...")
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def dl_task(p):
        pid = str(p["id"])
        img_url = p.get("url_l") or p.get("url_m")
        if not img_url:
            return False
        temp_img = temp_dir / f"photo_{pid}.jpg"
        for attempt in range(2):
            try:
                urllib.request.urlretrieve(img_url, temp_img)
                return True
            except Exception:
                import time
                time.sleep(0.3)
        return False

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(dl_task, p) for p in to_download]
        done_count = 0
        for f in as_completed(futures):
            if f.result():
                done_count += 1
            print(f"  [{done_count}/{len(to_download)}] Downloaded previews", end="\r")

    print(f"\nDownloaded {done_count} previews. Running Apple Vision Neural OCR...\n")

    cmd = [str(TAGGER_BIN), str(temp_dir), "--season", season]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    output = proc.stdout

    tagged_count = 0
    skipped_blur_count = 0
    import re
    ansi_escape = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

    photo_lookup = {str(p["id"]): p for p in photos}

    for raw_line in output.splitlines():
        line = ansi_escape.sub('', raw_line)
        if "photo_" in line and "Bib #" in line:
            # Format: [1/15] photo_54377022356.jpg: Bib #724 → Michael LEWIS (Parc Bryn Bach RC) ...
            try:
                pid_part = line.split("photo_")[1].split(".jpg")[0]
                bib_part = line.split("Bib #")[1].split(" → ")[0].strip()
                runner_part = line.split(" → ")[1]
                
                runner_name = ""
                runner_club = ""
                if "Unregistered" in runner_part:
                    runner_name = ""
                    runner_club = ""
                elif "(" in runner_part:
                    runner_name = runner_part.split("(")[0].strip()
                    runner_club = runner_part.split("(")[1].split(")")[0].strip()
                else:
                    runner_name = runner_part.split("[")[0].strip()

                temp_img = temp_dir / f"photo_{pid_part}.jpg"
                sharpness = calculate_subject_sharpness(temp_img) if temp_img.exists() else 0.0

                if min_sharpness > 0 and sharpness > 0 and sharpness < min_sharpness:
                    skipped_blur_count += 1
                    print(f"  🟡 Photo {pid_part} skipped: blurry/low sharpness ({sharpness} < {min_sharpness})")
                    continue

                photo_obj = photo_lookup.get(pid_part, {})
                server = photo_obj.get("server", "")
                secret = photo_obj.get("secret", "")
                url_m = photo_obj.get("url_m") or (f"https://live.staticflickr.com/{server}/{pid_part}_{secret}_m.jpg" if server and secret else "")
                url_l = photo_obj.get("url_l") or (f"https://live.staticflickr.com/{server}/{pid_part}_{secret}_b.jpg" if server and secret else "")

                entry = {
                    "bib": bib_part,
                    "name": runner_name,
                    "club": runner_club,
                    "album_id": album_id,
                    "server": server,
                    "secret": secret,
                    "url_m": url_m,
                    "url_l": url_l,
                    "sharpness": sharpness
                }
                for sz_key in ["url_h", "url_k", "url_3k", "url_4k"]:
                    if photo_obj.get(sz_key):
                        entry[sz_key] = photo_obj[sz_key]

                existing_index[pid_part] = entry
                tagged_count += 1
                print(f"  🟢 Photo {pid_part} → Bib #{bib_part} ({runner_name} • {runner_club}) [Sharpness: {sharpness}]")
            except Exception as e:
                pass

    # Clean up temp folder
    shutil.rmtree(temp_dir, ignore_errors=True)

    # Save index file
    with open(index_file, "w") as f:
        json.dump(existing_index, f, indent=2)

    print(f"\n=================================================================")
    print(f"SCAN COMPLETE: Tagged {tagged_count} photos. (Filtered out {skipped_blur_count} blurry photos)")
    print(f"Updated index saved to: {index_file} (Total indexed: {len(existing_index)})")
    print(f"Zero local storage retained (Temporary previews deleted).")
    print(f"=================================================================\n")
    return tagged_count, len(existing_index)

def main():
    parser = argparse.ArgumentParser(description="Scan Flickr album and auto-index bibs for glcl.uk/photos.html")
    parser.add_argument("album_id", help="Flickr Album/Photoset ID (e.g. 72177720324324441)")
    parser.add_argument("--season", default="2024/2025", help="Season name for bib lookup (e.g. 2024/2025 or 2026/2027)")
    parser.add_argument("--limit", type=int, default=30, help="Maximum number of photos to scan (default 30 for PoC)")
    parser.add_argument("--min-sharpness", type=float, default=250.0, help="Minimum subject sharpness score to index (default 250, set 0 to disable)")
    args = parser.parse_args()

    scan_album(args.album_id, season=args.season, limit=args.limit, min_sharpness=args.min_sharpness)

if __name__ == "__main__":
    main()
