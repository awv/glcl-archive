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

FLICKR_API_KEY = "d6f7a2fa79fb6eadfcb13be7282ef019"
INDEX_FILE = Path("assets/data/photo_tags.json")
TAGGER_BIN = Path("backend_tools/glcl-tagger")

ssl._create_default_https_context = ssl._create_unverified_context

def fetch_album_photos(photoset_id, max_photos=50):
    photos = []
    page = 1
    per_page = min(max_photos, 100)
    
    while len(photos) < max_photos:
        url = (
            f"https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos"
            f"&api_key={FLICKR_API_KEY}&photoset_id={photoset_id}"
            f"&extras=url_l,url_m,tags&per_page={per_page}&page={page}&format=json&nojsoncallback=1"
        )
        try:
            req = urllib.request.urlopen(url)
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

    return photos[:max_photos]

def main():
    parser = argparse.ArgumentParser(description="Scan Flickr album and auto-index bibs for glcl.uk/photos.html")
    parser.add_argument("album_id", help="Flickr Album/Photoset ID (e.g. 72177720324324441)")
    parser.add_argument("--season", default="2024/2025", help="Season name for bib lookup (e.g. 2024/2025 or 2026/2027)")
    parser.add_argument("--limit", type=int, default=30, help="Maximum number of photos to scan (default 30 for PoC)")
    args = parser.parse_args()

    if not TAGGER_BIN.exists():
        print("Error: backend_tools/glcl-tagger binary not found. Please compile it first.")
        sys.exit(1)

    INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing_index = {}
    if INDEX_FILE.exists():
        try:
            with open(INDEX_FILE, "r") as f:
                existing_index = json.load(f)
        except Exception:
            existing_index = {}

    print(f"=================================================================")
    print(f"📸 Streaming Flickr Album: {args.album_id} (Limit: {args.limit} photos)")
    print(f"Season: {args.season}")
    print(f"=================================================================")

    photos = fetch_album_photos(args.album_id, max_photos=args.limit)
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
        return

    print("Downloading preview thumbnails from Flickr CDN...")
    for i, p in enumerate(to_download):
        pid = str(p["id"])
        img_url = p.get("url_l") or p.get("url_m")
        if not img_url:
            continue
        temp_img = temp_dir / f"photo_{pid}.jpg"
        try:
            urllib.request.urlretrieve(img_url, temp_img)
            print(f"  [{i+1}/{len(to_download)}] Downloaded {pid}", end="\r")
        except Exception as e:
            print(f"  Error downloading {pid}: {e}")

    print(f"\nDownloaded {len(to_download)} previews. Running Apple Vision Neural OCR...\n")

    cmd = [str(TAGGER_BIN), str(temp_dir), "--season", args.season]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    output = proc.stdout

    tagged_count = 0
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
                if "(" in runner_part:
                    runner_name = runner_part.split("(")[0].strip()
                    runner_club = runner_part.split("(")[1].split(")")[0].strip()
                else:
                    runner_name = runner_part.split("[")[0].strip()

                photo_obj = photo_lookup.get(pid_part, {})
                server = photo_obj.get("server", "")
                secret = photo_obj.get("secret", "")
                url_m = photo_obj.get("url_m") or (f"https://live.staticflickr.com/{server}/{pid_part}_{secret}_m.jpg" if server and secret else "")
                url_l = photo_obj.get("url_l") or (f"https://live.staticflickr.com/{server}/{pid_part}_{secret}_b.jpg" if server and secret else "")

                existing_index[pid_part] = {
                    "bib": bib_part,
                    "name": runner_name,
                    "club": runner_club,
                    "album_id": args.album_id,
                    "server": server,
                    "secret": secret,
                    "url_m": url_m,
                    "url_l": url_l
                }
                tagged_count += 1
                print(f"  🟢 Photo {pid_part} → Bib #{bib_part} ({runner_name} • {runner_club})")
            except Exception as e:
                pass

    # Clean up temp folder
    shutil.rmtree(temp_dir, ignore_errors=True)

    # Save index file
    with open(INDEX_FILE, "w") as f:
        json.dump(existing_index, f, indent=2)

    print(f"\n=================================================================")
    print(f"SCAN COMPLETE: Tagged {tagged_count} photos.")
    print(f"Updated index saved to: {INDEX_FILE} (Total indexed: {len(existing_index)})")
    print(f"Zero local storage retained (Temporary previews deleted).")
    print(f"=================================================================\n")

if __name__ == "__main__":
    main()
