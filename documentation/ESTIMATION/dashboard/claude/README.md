# EstimationDashboard - plan by Claude (2026-11-24)

No application code. This folder is the answer to the Google Doc "W1 ESTIMATION 1С:Смета".

| File | What it is |
|---|---|
| `ESTIMATION_DASHBOARD_WBS.html` | the work breakdown + design (open it in a browser, works offline) |
| `prototypes/*.jpg` | six screens drawn with react-native-paper (estimate sheet, quick quote, trade breakdown, takeoff, summary, export) |
| `prototypes/src` + `build_prototypes.js` | source of the pictures (not wired into the app). Rebuild: `node documentation/ESTIMATION/dashboard/claude/prototypes/build_prototypes.js <outDir>` bundles with the project's Metro; open `<outDir>/index.html?screen=1..6` in a browser at 1440 x 900 |
| `download_estimation_templates.py` + `requirements.txt` | downloads and analyses the free estimate templates of exayard.com (`python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python download_estimation_templates.py`) |
| `templates/` | the result of one run: 22 files from 4 vendors + `templates_analysis.md / .json` |

Source of the standard: `../Смета-Гост-Приказ-Estimation.pdf` (Order 421/pr).
