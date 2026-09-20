# LabΔ (LabDelta) — Report Diff Engine

> **Previous → Current → Δ**  
> *Compare Lab Reports. See What Changed.*

LabΔ is an intelligent laboratory report difference and trajectory tracking engine. Instead of forcing patients and clinicians to manually scan multi-page diagnostic PDFs side by side, LabΔ extracts, normalizes, and compares biomarkers across reports to immediately compute baseline differences ($\Delta$), highlight emergent or missing measurements, and visualize chronological health trajectories.

---

## 🎯 Demo Account & Quick Evaluation Guide

For hackathon reviewers and evaluators, the live deployment at [lab-delta-git-main-akshatjpatel11-3100.vercel.app](https://lab-delta-git-main-akshatjpatel11-3100.vercel.app) is pre-configured with active demonstration records.

### Live Demo Credentials
- **Email**: `demo@labdelta.com`
- **Password**: *(Pre-authenticated in your browser session or use standard login)*

---

## 🧪 How to Test Key Features with Sample Reports (`demo_reports/`)

The repository includes a dedicated [`demo_reports/`](demo_reports/) folder containing 7 realistic, synthetic single-page laboratory reports across 7 distinct medical document layouts.

### 1. Test Duplicate Report Detection ⚠️
To test LabΔ's exact duplicate report prevention:
1. Click **`+ Add Report`** in the top navigation and select **"Upload PDF Report"**.
2. Upload **[`demo_reports/LabDelta_Demo_Report_2026-09-18_Redwood_Diagnostic.pdf`](demo_reports/LabDelta_Demo_Report_2026-09-18_Redwood_Diagnostic.pdf)**.
3. *(This report is already recorded in the demo account).*
4. **Observed Behavior**:
   - LabΔ extracts the data and immediately detects that an identical report (same user, same date `2026-09-18`, same lab `Redwood Diagnostic Medical Center`, and matching measurement values) already exists.
   - The interface displays an **amber duplicate warning banner** and smoothly auto-scrolls to the top so the alert is immediately visible.
   - The user is offered **"Review / Cancel"** to prevent accidental clutter, or **"Save Duplicate Anyway"** if they explicitly wish to proceed.

### 2. Test AI Multi-Format PDF Extraction 📄
To test AI extraction across diverse laboratory document styles, upload any of the unrecorded reports from `demo_reports/`:
- **[`LabDelta_Demo_Report_2026-02-28_Metro_Hospital.pdf`](demo_reports/LabDelta_Demo_Report_2026-02-28_Metro_Hospital.pdf)**: Hospital Pathology format with boxed panels and `[H]` / `[L]` flag column.
- **[`LabDelta_Demo_Report_2026-04-05_Apex_Monospace.pdf`](demo_reports/LabDelta_Demo_Report_2026-04-05_Apex_Monospace.pdf)**: Classic typewriter/monospace laboratory printout with ASCII dividers.
- **[`LabDelta_Demo_Report_2026-05-22_HealthLab_Clinical.pdf`](demo_reports/LabDelta_Demo_Report_2026-05-22_HealthLab_Clinical.pdf)**: Card-style diagnostic panel with alternating row fills.
- **[`LabDelta_Demo_Report_2026-07-08_Summit_Endocrine.pdf`](demo_reports/LabDelta_Demo_Report_2026-07-08_Summit_Endocrine.pdf)**: Specialty Endocrine format featuring qualitative/categorical results (`Urine Protein: Negative`).
- **[`LabDelta_Demo_Report_2026-08-14_CarePoint_Urgent.pdf`](demo_reports/LabDelta_Demo_Report_2026-08-14_CarePoint_Urgent.pdf)**: Rapid Urgent Care STAT report layout.

---

## 🔬 Core Product Capabilities

### 1. Automated $\Delta$ Comparison Engine
- **Deterministic Diff Classification**: Categorizes every marker into `CHANGED`, `UNCHANGED`, `NEW` (emerged in current report), or `MISSING` (absent from current report).
- **Alias Normalization**: Normalizes disparate laboratory terminologies (e.g. `HGB`, `Haemoglobin`, and `Hemoglobin` all map to the same biomarker; `Plt` and `Platelets` map together).
- **Unit Mismatch Safety Isolation**: When two reports measure a biomarker in incompatible units (e.g., Vitamin D in `ng/mL` vs `nmol/L`), LabΔ flags the measurement as `UNABLE_TO_COMPARE` rather than calculating misleading mathematical differences.
- **Categorical Marker Handling**: Gracefully handles qualitative outcomes (e.g. "Borderline", "Negative", "Positive") without crashing or forcing numeric status.

### 2. Longitudinal Trajectory Trends
- **Multi-Point Interactive Sparklines & Charts**: Built on Recharts with custom tooltips, reference range status badges (`Within provided range`, `Below provided range`, `Above provided range`), and net delta percentages.
- **Unit Switcher**: For markers measured in multiple units across time, users can toggle between isolated unit groups without mathematical contamination.

### 3. Strict Medical Neutrality
- LabΔ is engineered as a mathematical diff engine, not a diagnostic oracle. It reports objective numerical changes and report-provided reference limits without making unauthorized clinical judgments (e.g., avoiding words like "cured", "healthy", "optimal").

---

## 🏗️ Architecture & Technology Stack

```text
LabDelta/
├── backend/
│   ├── extraction.py      # PyMuPDF text stream extraction + Groq LLM clinical parser
│   ├── main.py            # FastAPI REST endpoints (/extract, /health, /auth/me)
│   ├── auth.py            # Supabase JWT token verification
│   └── config.py          # Configuration and environment loaders
├── frontend/
│   ├── src/
│   │   ├── components/    # DashboardView, ReportsView, CompareView, TrendsView, AddReportModal
│   │   ├── context/       # ReportsContext (centralized caching & multi-view sync)
│   │   ├── lib/           # normalization, comparison, trends, duplicateDetection, formatting
│   │   └── App.jsx        # Responsive navigation, theme switching (Light/Dark), global toast
├── demo_reports/          # 7 multi-format synthetic sample PDFs for testing
├── scripts/               # PDF generator and maintenance tools
└── tests/                 # 45-point regression suite, duplicate detection, trends, format verification
```

- **Frontend**: React 19, Vite, Tailwind CSS, Recharts, Heroicons, Supabase JS client.
- **Backend**: FastAPI, Python 3.12+, PyMuPDF (fitz), Groq Python SDK (`openai/gpt-oss-20b` temperature 0.0), Pydantic v2.
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) enforcing strict tenant data isolation.

---

## 🚀 Local Development Setup

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1 | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` to access the application.

---

## 🧪 Verification & Automated Test Suites

LabΔ includes a rigorous, multi-layer verification suite covering all functional, mathematical, and security requirements:

```bash
# 1. 45-Point Stage 7 Full Regression Suite (Live Supabase & FastAPI)
python tests/test_stage7_regression.py

# 2. Duplicate Report Detection Unit Suite
node tests/test_duplicate_detection.mjs

# 3. Trends & Unit Isolation Unit Suite
node tests/test_trends.mjs

# 4. Range Status & Compare Derivation Suite
node tests/test_compare.mjs

# 5. 7 Multi-Format PDF Verification (PyMuPDF)
python tests/verify_demo_reports.py

# 6. Live PDF AI Metadata Extraction Suite
python tests/test_pdf_metadata_extraction.py

# 7. Production Frontend Build Check
npm --prefix frontend run build
```

---

## 📄 License & Synthetic Data Notice
All patient names, medical facility records, and test outcomes used in demonstration datasets and PDF reports are entirely synthetic and generated for technical evaluation only.
