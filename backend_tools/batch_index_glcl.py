#!/usr/bin/env python3
"""
GLCL Multi-Album Batch Indexer
Iterates through mapped GLCL Flickr albums, automatically downloading thumbnails,
recognizing runner bib numbers using Apple Vision Neural Engine, and saving CDN photo links
into assets/data/photo_tags.json for instant runner search on glcl.uk/photos.html and results.html.

Zero local disk retention: all previews are deleted after OCR analysis.

Usage:
  # Scan recent seasons (2024/2025 & 2025/2026), 30 photos per album:
  python3 backend_tools/batch_index_glcl.py --recent --limit 30

  # Scan a specific season:
  python3 backend_tools/batch_index_glcl.py --season 2024/2025 --limit 50

  # Scan all 39 GLCL albums in the archive:
  python3 backend_tools/batch_index_glcl.py --all --limit 25
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path

# Add backend_tools to path for import
sys.path.insert(0, str(Path(__file__).parent))
from scan_flickr_album import scan_album

ALBUM_MAP_FILE = Path("assets/data/fixture_photo_albums.json")
INDEX_FILE = Path("assets/data/photo_tags.json")

def load_albums():
    if not ALBUM_MAP_FILE.exists():
        print(f"Error: {ALBUM_MAP_FILE} not found.")
        sys.exit(1)

    with open(ALBUM_MAP_FILE) as f:
        data = json.load(f)

    # Collect unique album objects
    albums = {}
    for k, v in data.items():
        aid = v.get("album_id")
        if not aid:
            continue
        if aid not in albums:
            albums[aid] = {
                "album_id": aid,
                "title": v.get("title", f"Album {aid}"),
                "season": v.get("season", "Unknown"),
                "photos": v.get("photos", 0),
                "discipline": v.get("discipline", "xc"),
                "venue": v.get("venue", "")
            }
        elif not albums[aid].get("season") and v.get("season"):
            albums[aid]["season"] = v["season"]
            albums[aid]["venue"] = v.get("venue", "")

    return list(albums.values())

def print_summary():
    if not INDEX_FILE.exists():
        return

    with open(INDEX_FILE) as f:
        tags = json.load(f)

    print("\n" + "=" * 65)
    print(f"📊 GLCL PHOTO INDEX SUMMARY: {len(tags)} Verified Photos Tagged")
    print("=" * 65)

    # Breakdown by club
    clubs = {}
    runners = {}
    for meta in tags.values():
        c = meta.get("club") or "Unattached"
        r = meta.get("name") or "Unknown"
        clubs[c] = clubs.get(c, 0) + 1
        runners[r] = runners.get(r, 0) + 1

    print("🏆 Top Tagged Clubs:")
    for club, count in sorted(clubs.items(), key=lambda x: x[1], reverse=True)[:8]:
        print(f"   • {club:35} : {count:3} photos")

    print("\n🏃 Top Tagged Athletes:")
    for runner, count in sorted(runners.items(), key=lambda x: x[1], reverse=True)[:8]:
        print(f"   • {runner:35} : {count:3} photos")
    print("=" * 65 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Batch index GLCL Flickr albums")
    parser.add_argument("--recent", action="store_true", help="Index recent seasons (2024/2025 and 2025/2026)")
    parser.add_argument("--historical", action="store_true", help="Index historical seasons (2017–2024)")
    parser.add_argument("--season", help="Index a specific season (e.g. 2024/2025)")
    parser.add_argument("--all", action="store_true", help="Index all available GLCL albums")
    parser.add_argument("--limit", type=int, default=30, help="Max photos to analyze per album (default 30)")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay in seconds between albums (default 1.0)")
    args = parser.parse_args()

    all_albums = load_albums()

    target_albums = []
    if args.season:
        target_albums = [a for a in all_albums if a.get("season") == args.season]
    elif args.recent:
        target_albums = [a for a in all_albums if a.get("season") in ("2024/2025", "2025/2026")]
    elif args.historical:
        target_albums = [a for a in all_albums if a.get("season") not in ("2024/2025", "2025/2026")]
    elif args.all:
        target_albums = all_albums
    else:
        # Default to recent if no flag provided
        print("No filter specified. Defaulting to recent seasons (2024/2025 & 2025/2026). Use --all or --season to customize.")
        target_albums = [a for a in all_albums if a.get("season") in ("2024/2025", "2025/2026")]

    print(f"\n🚀 GLCL BATCH PHOTO INDEXER")
    print(f"Albums queued: {len(target_albums)}")
    print(f"Photo limit per album: {args.limit}")
    print(f"Target index file: {INDEX_FILE}\n")

    total_tagged_in_run = 0

    for idx, album in enumerate(target_albums, 1):
        aid = album["album_id"]
        title = album["title"]
        season = album.get("season") or "2024/2025"
        
        print(f"\n[{idx}/{len(target_albums)}] Processing: {title} (ID: {aid}, Season: {season})")
        
        try:
            tagged, total = scan_album(aid, season=season, limit=args.limit, index_file=INDEX_FILE)
            total_tagged_in_run += tagged
        except KeyboardInterrupt:
            print("\n⚠️ Batch run interrupted by user. Partial progress saved.")
            break
        except Exception as e:
            print(f"❌ Error scanning album {aid}: {e}")

        if idx < len(target_albums) and args.delay > 0:
            time.sleep(args.delay)

    print(f"\n🎉 BATCH COMPLETED!")
    print(f"Newly tagged in this run: {total_tagged_in_run} photos")
    print_summary()

if __name__ == "__main__":
    main()
