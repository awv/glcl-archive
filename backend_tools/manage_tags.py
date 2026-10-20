#!/usr/bin/env python3
"""
GLCL Photo Tag Manager & Correction Tool
Quick CLI tool to inspect, remove false positives, or reassign photos in assets/data/photo_tags.json.

Usage:
  # Inspect a photo:
  python3 backend_tools/manage_tags.py show 55282256410

  # Reassign a photo:
  python3 backend_tools/manage_tags.py reassign 55282256410 --name "Phillip MATTHEWS" --club "Parc Bryn Bach RC" --bib 732

  # Remove a false positive match:
  python3 backend_tools/manage_tags.py remove 54867055148

  # List all 1- and 2-digit bib matches for review:
  python3 backend_tools/manage_tags.py list-short-bibs --album 72177720333773749
"""

import sys
import json
import argparse
from pathlib import Path

INDEX_FILE = Path("assets/data/photo_tags.json")
CORRECTIONS_FILE = Path("assets/data/photo_corrections.json")

def load_tags():
    if not INDEX_FILE.exists():
        print(f"Error: {INDEX_FILE} not found.")
        sys.exit(1)
    with open(INDEX_FILE, "r") as f:
        return json.load(f)

def save_tags(tags):
    with open(INDEX_FILE, "w") as f:
        json.dump(tags, f, indent=2)
    print(f"✅ Saved updated index to {INDEX_FILE} (Total: {len(tags)} photos)")

def log_correction(pid, action, details):
    corrections = {}
    if CORRECTIONS_FILE.exists():
        try:
            with open(CORRECTIONS_FILE, "r") as f:
                corrections = json.load(f)
        except Exception:
            corrections = {}
    corrections[str(pid)] = {"action": action, **details}
    with open(CORRECTIONS_FILE, "w") as f:
        json.dump(corrections, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description="GLCL Photo Tag Management CLI")
    subparsers = parser.add_subparsers(dest="cmd")

    # SHOW
    show_p = subparsers.add_parser("show", help="Show metadata for a photo")
    show_p.add_argument("photo_id", help="Flickr Photo ID")

    # REMOVE
    rm_p = subparsers.add_parser("remove", help="Remove false match from index")
    rm_p.add_argument("photo_id", help="Flickr Photo ID")
    rm_p.add_argument("--reason", default="Manual review false match", help="Reason for removal")

    # REASSIGN
    re_p = subparsers.add_parser("reassign", help="Reassign photo to correct runner")
    re_p.add_argument("photo_id", help="Flickr Photo ID")
    re_p.add_argument("--name", required=True, help="Correct runner name")
    re_p.add_argument("--club", required=True, help="Correct club name")
    re_p.add_argument("--bib", default="", help="Correct bib number")

    # LIST SHORT BIBS
    ls_p = subparsers.add_parser("list-short-bibs", help="List 1- and 2-digit bib matches")
    ls_p.add_argument("--album", help="Filter by Flickr Album ID")
    ls_p.add_argument("--limit", type=int, default=50, help="Max to display (default 50)")

    args = parser.parse_args()
    tags = load_tags()

    if args.cmd == "show":
        pid = str(args.photo_id)
        if pid not in tags:
            print(f"❌ Photo {pid} not found in {INDEX_FILE}")
            sys.exit(1)
        p = tags[pid]
        print(f"\n📸 Photo {pid}:")
        print(f"  Runner:    {p.get('name', 'Unregistered')}")
        print(f"  Bib:       {p.get('bib', '-')}")
        print(f"  Club:      {p.get('club', '-')}")
        print(f"  Album ID:  {p.get('album_id', '-')}")
        print(f"  Sharpness: {p.get('sharpness', 'N/A')}")
        print(f"  Flickr:    https://www.flickr.com/photos/35034352089@N01/{pid}")
        print(f"  Thumb:     {p.get('url_m', '-')}\n")

    elif args.cmd == "remove":
        pid = str(args.photo_id)
        if pid not in tags:
            print(f"❌ Photo {pid} not found.")
            sys.exit(1)
        old = tags.pop(pid)
        save_tags(tags)
        log_correction(pid, "remove", {"old": old, "reason": args.reason})
        print(f"🗑️ Removed photo {pid} ({old.get('name')} • Bib #{old.get('bib')}).")

    elif args.cmd == "reassign":
        pid = str(args.photo_id)
        if pid not in tags:
            print(f"❌ Photo {pid} not found.")
            sys.exit(1)
        old = dict(tags[pid])
        tags[pid]["name"] = args.name.strip()
        tags[pid]["club"] = args.club.strip()
        tags[pid]["bib"] = args.bib.strip()
        save_tags(tags)
        log_correction(pid, "reassign", {"old": old, "new": tags[pid]})
        print(f"✨ Reassigned photo {pid} to {args.name} ({args.club}, Bib #{args.bib}).")

    elif args.cmd == "list-short-bibs":
        candidates = []
        for pid, p in tags.items():
            b = str(p.get("bib", "")).strip()
            if b and len(b) <= 2:
                if args.album and str(p.get("album_id")) != str(args.album):
                    continue
                candidates.append((pid, b, p.get("name", "Unknown"), p.get("club", "Unknown"), p.get("sharpness", 0), p.get("url_m", "")))
        print(f"\n🔍 Found {len(candidates)} photos with 1- or 2-digit bibs:")
        print(f"{'PHOTO ID':<14} {'BIB':<5} {'SHARPNESS':<10} {'RUNNER':<25} {'CLUB'}")
        print("=" * 75)
        for pid, b, name, club, sh, u in candidates[:args.limit]:
            print(f"{pid:<14} {b:<5} {str(sh):<10} {name:<25} {club}")
        if len(candidates) > args.limit:
            print(f"... and {len(candidates) - args.limit} more.")
        print()

    else:
        parser.print_help()

if __name__ == "__main__":
    main()
