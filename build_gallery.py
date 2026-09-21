import os
import json
import random
from PIL import Image, ImageOps

# Base directory is wherever this script file lives
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
folder = os.path.join(BASE_DIR, "assets", "images", "40th")
output_path = os.path.join(BASE_DIR, "assets", "js", "gallery-data.js")

valid_extensions = {".jpg", ".jpeg", ".png", ".webp"}
MAX_DIMENSION = 2500

print(f"Scanning folder: {folder}")

if not os.path.exists(folder):
    print(f"Error: Folder does not exist: {folder}")
    exit(1)

photos = []
files = sorted(os.listdir(folder))
print(f"Found {len(files)} total items in directory.")

for filename in files:
    name, ext = os.path.splitext(filename)
    if ext.lower() in valid_extensions:
        file_path = os.path.join(folder, filename)

        try:
            with Image.open(file_path) as img:
                img = ImageOps.exif_transpose(img)
                w, h = img.size

                if max(w, h) > MAX_DIMENSION:
                    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
                    if img.mode in ("RGBA", "P") and ext.lower() in {".jpg", ".jpeg"}:
                        img = img.convert("RGB")
                    img.save(file_path, quality=85, optimize=True)
                    print(f"Resized {filename} (was {w}x{h})")
                else:
                    print(f"Kept {filename} ({w}x{h})")

        except Exception as e:
            print(f"Skipping resize for {filename}: {e}")

        # Web-friendly path relative to root
        photos.append({
            "src": f"assets/images/40th/{filename}",
            "caption": ""
        })

# Shuffle once so races are mixed up, but the order remains fixed in the generated file
random.shuffle(photos)

os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    f.write("window.glclGallery = " + json.dumps(photos, indent=2) + ";\n")

print(f"\nSuccess! Wrote {len(photos)} photos to {output_path}")