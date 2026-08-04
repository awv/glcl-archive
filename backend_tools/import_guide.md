# GLCL Archive — Results Import Guide

A complete reference guide for importing new race results from PDFs into `data.js`.

---

## 📂 Folder Structure

* `backend_tools/2026_Results/pdf_source/`  
  👉 Drop new official race PDFs here (e.g. `GLCL_2026_ROAD_RACE_5.pdf`).
* `backend_tools/results_source/`  
  👉 Generated text files live here (e.g. `road_2025_2026_5.txt`).
* `backend_tools/parse_results.py`  
  👉 Python script to extract PDF text & standardise category/club data.
* `backend_tools/parse_fixtures.js`  
  👉 Node script to compile text files into `data.js`.
* `data.js`  
  👉 Root data file populated by the build process.

---

## ⚡ Step-by-Step Import Workflow

### Step 1: Drop in the PDF
Place the official race PDF into `backend_tools/2026_Results/pdf_source/`.

### Step 2: Parse PDF to Text
Run the Python parser script from your terminal:
```bash
python backend_tools/parse_results.py
```
* Checks all PDFs in `pdf_source/`.
* Normalises age categories (e.g. converting `M35` to `V35`).
* Generates a matching text file in `results_source/`.
* Watch the terminal output for any `Skipped row:` warnings.

### Step 3: Check Text File Headers
Open the generated `.txt` file in `results_source/` (e.g. `road_2025_2026_5.txt`) and verify the metadata headers at the top:
```text
# VENUE: Parc Bryn Bach
# DATE: 2026-08-04
# DISTANCE: 5.14 Miles
# STATUS: Confirmed
```
* **Status Check:** Ensure `# STATUS:` is set to `Confirmed` (change it if it parsed as `Pending`).
* **Metadata Check:** Verify that `# VENUE:` and `# DATE:` parsed accurately from the PDF header.

### Step 4: Build Master `data.js`
Run the Node compiler script:
```bash
node backend_tools/parse_fixtures.js
```
* When you see **`Automated Build Success`**, your root `data.js` file is updated.
* Refresh the site to view the live results across the Fixture Board, Analytics, and Race Reports.

---

## 🛠️ Common Fixes & Troubleshooting

* **Skipped Rows during Python Parsing:**  
  If the official PDF layout changes column order or drops spacing, `METRICS_REGEX` in `parse_results.py` might skip lines. Adjust the regular expression inside `parse_results.py` to match the new PDF column structure.
* **New Club Aliases:**  
  If a runner's club appears as `Unknown` or isn't normalising correctly, add the raw club name string to the `clubAliases` object inside `parse_fixtures.js`.
* **New Season Rollover:**  
  When moving to a new campaign (e.g. 2026/2027), update the season string formatting inside `parse_results.py`:
  ```python
  txt_filename = f"road_2026_2027_{race_number}.txt"
