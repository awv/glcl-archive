# GLCL Archive — Master Operations Playbook & SOP

This playbook defines standard operating procedures (SOP) for maintaining the **Gwent League Cross Country & Road Racing Archive**. It ensures consistent identity resolution, zero false data, and repeatable workflows across all seasons.

---

## 🏛️ Core Architectural Principles

1. **The Identity Triad**:
   - **GLCL Bib Number**: The official race number worn on kits and displayed on the website.
   - **UKA URN**: The permanent UK Athletics registration number (never changes across a runner's career).
   - **Parkrun Barcode**: The personal athlete token (`A######`) used at finish line scanners.
2. **Explicit-Only Hero Photos**:
   - Header hero photos on `athlete.html` must **never** be auto-assigned from unverified action shots. They are strictly rendered if explicitly configured in `assets/data/athlete_headers.json` or present as a dedicated portrait in `assets/images/athletes/`.
3. **Strict Club Identity**:
   - **Spirit of Monmouth RC**: Never refer to them as "Monmouth Harriers".
   - **Caldicot Running Club**: Full member club with bib series `1201+` (earlier legacy bibs `3501+`).
   - Club names and colors are governed by `assets/data/club_colours.json`.

---

## 🏃 Playbook A: Race Results Ingestion & Reconciliation

### Scenario A1: Ingesting a PDF with Bib Numbers
When the host club publishes a results PDF that includes race bibs (e.g. `BIB` column or Draft 1.1 format):

1. **Save the PDF**:
   Place the official PDF into `backend_tools/2026_Results/pdf_source/`.
   - File naming convention: `GLCL_2026~27_XC_RACE_1.pdf` or `GLCL_2026_ROAD_RACE_5.pdf`.
2. **Extract Text**:
   ```bash
   python3 backend_tools/2026_Results/parse_results.py
   ```
   *Automatically detects discipline (XC vs Road), season, and race number. Extracts `BIB` tokens after race time and populates `backend_tools/results_source/<discipline>_<season>_<race>.txt`.*
3. **Verify Metadata Headers**:
   Open the generated `.txt` file and confirm:
   ```text
   # VENUE: Glebelands
   # DATE: 2026-10-18
   # DISTANCE: 4.5 Miles
   # STATUS: Confirmed
   ```
4. **Compile Root `data.js`**:
   ```bash
   node backend_tools/parse_fixtures.js
   ```
5. **Verify & Push**:
   Inspect `git diff --stat data.js` and push to `main`.

---

### Scenario A2: Ingesting Barcode / URN-Only Results (No Bib Numbers in PDF)
When a host club records only finish tokens (e.g. `A8076042` Parkrun barcodes):

1. **Ensure Registry is Current**:
   ```bash
   python3 backend_tools/update_registry.py
   ```
2. **Run Parser**:
   ```bash
   python3 backend_tools/2026_Results/parse_results.py
   ```
   *The parser will detect `bib = "0"` and cross-reference `backend_tools/glcl_runner_registry.json` by Barcode first, then URN, then normalized full name + club. All 275+ runners are resolved to their official bib numbers automatically.*
3. **Compile Database**:
   ```bash
   node backend_tools/parse_fixtures.js
   ```

---

### Scenario A3: Reconciling Predictions Against Organiser Updates
If comparing predicted numbers against a newly updated organiser sheet:

1. Run the reconciliation script to verify 100% parity:
   ```bash
   python3 -c "
   import json, re
   # cross-reference results_source against glcl_runner_registry.json
   "
   ```
2. Check for **Bib Changes**:
   Verify whether runners with reissued numbers (e.g. Joby Eynon `8149`, *was 8033*) ran with their new bib or old bib.
3. Check for **Typo Quirks**:
   - Check registration sheet variations (e.g. "Suzanne Willams" vs "Suzanne Williams").
   - Check middle/compound surnames (e.g. "Thomas Brisco Williams" registered as "Thomas Williams").

---

## 📋 Playbook B: League Registration & Roster Synchronization

The registration portal (`https://sites.google.com/view/glclrunning-results-and-reg/home/entry-registration`) publishes live sheets for all 10 clubs.

### Sync Workflow
Run the one-click fetcher whenever new runners join or bib changes occur:
```bash
python3 backend_tools/update_registry.py
```
This automatically:
1. Connects to all 10 published Google Sheets tabs (`gid` mapping).
2. Cleans blank rows and standardizes names and clubs.
3. Preserves notes from the "Bib Change" column (e.g. `was 8033`).
4. Overwrites `backend_tools/glcl_runner_registry.json`.

---

## 📸 Playbook C: Race Photography Indexing & Tagging

To tag race photos by bib numbers, face embeddings, or runner identity:

### 1. High-Performance OCR Tagging (macOS Apple Vision)
Use the compiled Swift binary for local albums:
```bash
# Tag an album folder
./backend_tools/glcl-tagger /path/to/race_photos/ --output assets/data/photos/xc_2026_race_1.json
```
Features:
- Native Apple Vision `VNRecognizeTextRequest` (fast, high accuracy on kits).
- Automatically matches bib numbers against registered GLCL runners.
- Stores confidence scores and bounding boxes.

### 2. Flickr Album Ingestion
```bash
python3 backend_tools/index_album.py --album-id <FLICKR_ALBUM_ID> --race-id xc_2026_2027_1
```

### 3. Manual Tag Verification & Review
```bash
python3 backend_tools/manage_tags.py --review assets/data/photos/xc_2026_race_1.json
```

---

## 🎨 Playbook D: Athlete Hero Header Photos & Framing

### Explicit Header Assignment & Admin Edit Mode Security
To protect public users from seeing or tampering with editor controls, all editing features (the `📸 Choose Header` floating pill, `★ Header` card buttons, and `★ Set as Header` lightbox action) are **strictly hidden from the general public by default**.

1. **How to Activate Admin Edit Mode**:
   - **URL Parameter**: Open any athlete profile with `?admin=1` (or `?edit=1`), e.g.:
     `athlete.html?name=Joby+EYNON&admin=1`
   - **Keyboard Shortcut**: Alternatively, press **`Ctrl + Shift + E`** (or **`Cmd + Shift + E`** on Mac) on any athlete page.
   - Once activated, Admin Mode persists in your browser's `localStorage` across all athlete profiles until you exit.

2. **How to Exit Admin Edit Mode**:
   - Click the **`✕ Exit Admin`** button next to the header picker pill, or:
   - Press **`Ctrl + Shift + E`** / **`Cmd + Shift + E`** again, or:
   - Add `?admin=0` to the URL.

3. **Using the Header Picker (Admin Only)**:
   - Click **`📸 Choose Header`** (or click **`★ Header`** on any photo card).
   - In the modal:
     - Select from their tagged race photos, or enter an external image URL.
     - Adjust the **Vertical Framing** slider (`0%` top to `100%` bottom, default `25%` optimal for running portraits).
     - Click **Save as Header**.

4. **Exporting and Committing**:
   - Local edits persist immediately in your browser's `localStorage`.
   - Click **`⬇ Export athlete_headers.json`** inside the modal.
   - Replace `assets/data/athlete_headers.json` and push to git to deploy site-wide for all visitors.

5. **Custom Local Portraits**:
   - Save custom square or portrait photos directly to:
     `assets/images/athletes/<Runner_Name>.jpg`
   - The athlete page automatically picks up custom local portraits if no hero banner is explicitly chosen.

---

## 🎽 Playbook E: Club Kits, Colors & Branding

### 1. Club Nomenclature Standard
| Official Name | Prohibited Alias | Primary Bib Range |
| :--- | :--- | :--- |
| **Caerleon RC** | Caerleon Running Club | `1001` – `1105` |
| **Caldicot Running Club** | Caldicot RC | `1201` – `1225` (`3501+`) |
| **Chepstow Harriers** | — | `2001` – `2156` |
| **Fairwater Runners** | Fairwater Runners Cwmbran | `3001` – `3081` |
| **Griffithstown Harriers** | — | `4001` – `4133` |
| **Islwyn RC** | Islwyn Running Club | `5001` – `5211` |
| **Lliswerry Runners** | — | `6001` – `6203` |
| **Spirit of Monmouth RC** | Monmouth Harriers (Prohibited) | `7001` – `7060` |
| **Parc Bryn Bach RC** | PBB | `8001` – `8149` |
| **Pont-Y-Pwl & District Runners** | Pontypool | `9001` – `9108` |

### 2. Kit Palettes & Variations
- Reference sample vests and t-shirts located at:  
  `assets/images/Vests/`
- Color hex codes and badge accents are defined in:  
  `assets/data/club_colours.json`

---

## ⚡ Quick Reference CLI Cheat Sheet

```bash
# 1. Sync Runner Registration from Google Sheets
python3 backend_tools/update_registry.py

# 2. Parse a newly added PDF into text
python3 backend_tools/2026_Results/parse_results.py

# 3. Compile all fixture text files into data.js
node backend_tools/parse_fixtures.js

# 4. Check git diff before pushing
git diff --stat data.js

# 5. Tag photo album using native Swift OCR
./backend_tools/glcl-tagger /path/to/photos/ --output assets/data/photos/race_1.json
```
