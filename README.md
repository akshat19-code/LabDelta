# LabΔ (LabDelta) — Report Diff Engine

> Previous → Current → Δ  
> Compare Lab Reports. See What Changed.

---

## 🚀 Live Demo

- **Production URL**: [https://lab-delta-git-main-akshatjpatel11-3100.vercel.app/](https://lab-delta-git-main-akshatjpatel11-3100.vercel.app/)
- **Demo Account Email**: `demo@labdelta.com`
- **Demo Data Notice**: The demo account workspace is pre-populated with synthetic demonstration data for immediate evaluation. New users can also register an independent account via standard email sign-up.

---

## 🧩 What is LabΔ?

LabΔ is a laboratory report comparison tool that turns report data into structured measurements and makes changes between reports easy to inspect.

### Core Workflow:
```text
Upload → Extract → Verify → Save → Compare → Δ
```

- **Flexible Input**: Upload a text-based laboratory PDF report or enter values manually.
- **Pairwise Comparison**: Select any previous baseline report and current report to inspect differences.
- **Structured Categorization**: Categorizes every marker into changed, unchanged, new, missing, or unit-incompatible states.
- **Longitudinal Trends**: Visualizes historical biomarker trajectories over time across saved reports.

*Note: LabΔ is an informational data comparison and visualization tool. It is not a diagnostic system and does not provide medical advice or diagnosis.*

---

## 🎯 Problem

Clinical laboratory reports frequently contain dozens of measurements presented across different dates, laboratories, and document formats. Patients and healthcare professionals must often manually switch between multi-page documents or scan dense tables side by side to answer simple questions:
- *Which test values changed since the previous visit?*
- *By how much did a specific biomarker increase or decrease?*
- *Were any new tests added or previous tests omitted?*

LabΔ focuses specifically on solving this **data-diff problem** rather than offering clinical interpretations.

---

## 💡 Solution

LabΔ provides a structured, multi-step pipeline:

1. **Upload or Enter**: Upload a supported text PDF laboratory report or enter values manually.
2. **Extract**: Automatically extract report date, laboratory name, test names, numerical/categorical values, units, and reference ranges.
3. **Verify**: Inspect and edit all extracted rows in an interactive verification editor before committing data to the database.
4. **Save**: Commit verified reports securely to an authenticated Supabase PostgreSQL database protected by Row Level Security (RLS).
5. **Compare**: Select any two reports to immediately compute baseline differences ($\Delta$).
6. **Inspect & Track**: View calculated deltas, percentage changes, range statuses, and longitudinal trends across all recorded observations.

---

## 🔬 Key Features

### PDF Extraction
- **PyMuPDF Text Extraction**: Extracts selectable text streams directly from uploaded PDF documents without external optical rasterization.
- **AI-Assisted Structured Extraction**: Uses Groq (`openai/gpt-oss-20b` with temperature `0.0` and structured JSON mode) to extract report metadata and individual test rows.
- **Pre-Save Verification Editor**: Users review and can edit or remove any extracted field before saving.
- **Multi-Layout Support**: Handles tabular clinical grids, hospital pathology formats with flag columns, monospace printouts, and specialty clinic layouts.
- **Metadata Extraction**: Identifies report dates, laboratory names, test descriptions, values, units, and reference intervals where present.

### Manual Entry
- Option to manually enter laboratory reports when digital PDFs are unavailable.
- Dynamic row addition and deletion with support for numeric values, categorical text values, units, and reference ranges.

### Δ Comparison Engine
Computes deterministic comparisons between selected baseline and current reports:
- **CHANGED**: Identifies markers present in both reports whose values differ, reporting the signed mathematical difference ($\Delta$) and percentage change ($\Delta\%$).
- **UNCHANGED**: Flags markers that remained identical between observations.
- **NEW**: Identifies tests appearing in the current report that were absent from the baseline report.
- **MISSING**: Identifies tests recorded in the baseline report that were not measured in the current report.
- **Categorical Handling**: Supports non-numeric results (e.g., "Negative", "Borderline") and reports qualitative transitions.

### Alias Normalization
Normalizes disparate laboratory nomenclatures to common clinical entities:
- `HGB` / `Haemoglobin` / `Hemoglobin` $\rightarrow$ `Hemoglobin`
- `Plt` / `Platelets` $\rightarrow$ `Platelets`
- `WBC` / `WBC Count` $\rightarrow$ `WBC Count`
- `FBS` / `Fasting Blood Sugar` / `Fasting Glucose` $\rightarrow$ `Fasting Glucose`

### Unit Safety & Isolation
Prevents invalid mathematical calculations when identical biomarkers are recorded in incompatible units:
- **Example**: Vitamin D recorded in `ng/mL` in one report and `nmol/L` in another report is flagged as `UNABLE_TO_COMPARE` rather than performing an unverified numerical subtraction.
- In **Trends**, measurements with incompatible units are partitioned into strictly isolated unit groups, allowing users to toggle between unit views without mathematical cross-contamination.

### Duplicate Report Detection
Prevents accidental double-saving of identical reports while allowing legitimate distinct reports from the same laboratory on the same date:
- Evaluates: authenticated user ID, report date, case- and whitespace-normalized laboratory name, measurement count, normalized test names, values, and units.
- Triggers an amber warning banner with smooth auto-scroll to the top of the modal.
- Provides choices to **"Review / Cancel"** or explicitly **"Save Duplicate Anyway"**.

### Trends
- Interactive Recharts line graphs showing longitudinal biomarker progression over time.
- Custom tooltips displaying report date, laboratory, measured value, and report-provided reference range.
- Isolated unit group toggles.
- Standardized, neutral reference range status derivations:
  - **Within provided range**
  - **Below provided range**
  - **Above provided range**
  - **Range unavailable** (when reference bounds are non-numeric or absent)

---

## 🛡️ Responsible Design

- **Not a Diagnostic System**: LabΔ is strictly a mathematical comparison and visualization tool. It does not diagnose medical conditions, suggest treatments, prescribe medications, or replace qualified medical judgment.
- **Objective Information**: LabΔ reports numerical differences, report-provided reference ranges, and categorical changes. It does not output subjective health evaluations (e.g., avoiding words like "healthy", "unhealthy", "optimal", "cured", or "risk").
- **Synthetic Data**: All demonstration reports, patient records, facility names, and sample values in this repository are entirely synthetic technical test artifacts.

---

## 📊 Comparison Logic

| State | Meaning |
|---|---|
| **CHANGED** | Measurement exists in both reports and its value differs |
| **UNCHANGED** | Measurement exists in both reports with the exact same value |
| **NEW** | Measurement appears in the current report but not the previous report |
| **MISSING** | Measurement appears in the previous report but not the current report |
| **UNABLE_TO_COMPARE** | Measurement cannot be mathematically compared because the units differ |

---

## 📈 Trends

The Trends engine visualizes repeated measurements chronologically:
- Plots actual observed values from saved reports.
- Automatically handles disambiguation when multiple reports share the same date.
- Maintains isolated unit groups (e.g. `ng/mL` vs `nmol/L`) to prevent invalid unit conversions.

---

## 🧪 Demo Reports (`demo_reports/`)

The [`demo_reports/`](demo_reports/) folder contains 7 synthetic, single-page PDF reports created for technical evaluation and extraction testing:

1. **`LabDelta_Demo_Report_2026-01-15_City_Labs.pdf`**: Modern clinical tabular layout from City Labs Diagnostics with standard metabolic and hematology markers.
2. **`LabDelta_Demo_Report_2026-02-28_Metro_Hospital.pdf`**: Hospital pathology layout from Metro General Hospital featuring boxed panels and an `[H]` / `[L]` flag column.
3. **`LabDelta_Demo_Report_2026-04-05_Apex_Monospace.pdf`**: Classic monospace typewriter laboratory printout from Apex Diagnostic Laboratories with ASCII divider formatting.
4. **`LabDelta_Demo_Report_2026-05-22_HealthLab_Clinical.pdf`**: Card-style diagnostic panel from HealthLab Medical Diagnostics with alternating row fills and thyroid markers.
5. **`LabDelta_Demo_Report_2026-07-08_Summit_Endocrine.pdf`**: Specialty endocrine two-tone report from Summit Endocrine Center featuring qualitative/categorical test results (`Urine Protein: Negative`).
6. **`LabDelta_Demo_Report_2026-08-14_CarePoint_Urgent.pdf`**: Rapid Urgent Care STAT report layout from CarePoint Urgent Care Diagnostics.
7. **`LabDelta_Demo_Report_2026-09-18_Redwood_Diagnostic.pdf`**: Comprehensive annual executive health panel from Redwood Diagnostic Medical Center. *(Already pre-recorded in the demo account to allow testing of the duplicate report detection engine).*

---

## 🏗️ Architecture

```text
Browser
  ↓
React + Vite (Tailwind CSS, Recharts)
  ↓
Vercel
  ├── Static frontend hosting (SPA routing)
  └── /api → FastAPI Serverless Function (Python 3.12)
             ├── PDF text extraction (PyMuPDF)
             ├── AI structured extraction (Groq LLM)
             └── Supabase
                    ├── Authentication (JWT)
                    └── PostgreSQL (Row Level Security)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS |
| **Backend** | FastAPI, Python 3.12, Pydantic v2 |
| **Database & Auth** | Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS) |
| **PDF Processing** | PyMuPDF (fitz) |
| **AI Extraction** | Groq API (`openai/gpt-oss-20b`, JSON mode, temp 0.0) |
| **Data Visualization** | Recharts |
| **Hosting & Deployment** | Vercel (Frontend + Serverless Python API) |

---

## 📁 Project Structure

```text
LabDelta/
├── api/
│   └── index.py                     # Vercel serverless entrypoint for FastAPI
├── backend/
│   ├── auth.py                      # Supabase JWT token verification
│   ├── config.py                    # Environment variable configuration
│   ├── extraction.py                # PyMuPDF text parsing & Groq extraction
│   ├── main.py                      # FastAPI application endpoints
│   └── requirements.txt             # Backend dependencies
├── demo_reports/                    # 7 multi-format synthetic sample PDFs
├── frontend/
│   ├── public/                      # Static assets and favicon
│   ├── src/
│   │   ├── components/              # Dashboard, Reports, Compare, Trends, Modals
│   │   ├── context/                 # ReportsContext (centralized state & caching)
│   │   ├── lib/                     # Normalization, comparison, trends, duplicate detection
│   │   ├── App.jsx                  # Main application shell and routing
│   │   └── index.css                # Tailwind CSS styling and theme definitions
│   ├── package.json                 # Frontend dependencies and build scripts
│   └── vite.config.js               # Vite build configuration
├── scripts/
│   └── generate_fresh_demo_reports.py # PyMuPDF script generating demo PDFs
├── supabase/
│   └── schema.sql                   # Database schema, foreign keys, and RLS policies
├── tests/                           # Comprehensive test suites
├── vercel.json                      # Vercel deployment routing and configuration
├── requirements.txt                 # Root Python requirements for Vercel deployment
└── README.md                        # Project documentation
```

---

## 🚀 Local Development

### 1. Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Supabase account & project
- Groq Cloud API key

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` with:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
```

Run the FastAPI backend:
```bash
uvicorn backend.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create `frontend/.env` with:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=http://127.0.0.1:8000
```

Run the Vite development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Verification & Automated Test Suites

The codebase includes automated test suites covering backend regression, mathematical derivations, normalization, duplicate detection, and PDF generation:

| Test Suite | Command | What It Verifies |
|---|---|---|
| **Stage 7 Regression Suite** | `python tests/test_stage7_regression.py` | 45 comprehensive end-to-end assertions against live Supabase & FastAPI |
| **Duplicate Report Detection** | `node tests/test_duplicate_detection.mjs` | 13 unit tests verifying exact match detection, alias normalization, and unit safety |
| **Longitudinal Trends Suite** | `node tests/test_trends.mjs` | 33 unit tests for trend curves, unit mismatch isolation, and duplicate date disambiguation |
| **Comparison Derivation Suite** | `node tests/test_compare.mjs` | 6 unit tests verifying range status derivations across comparative metrics |
| **7 Demo Reports Verification** | `python tests/verify_demo_reports.py` | 7 PyMuPDF checks verifying single-page structure, metadata, text, and synthetic disclaimers |
| **Live PDF Metadata Extraction** | `python tests/test_pdf_metadata_extraction.py` | 8 live extraction tests verifying date normalization, lab detection, and error handling |
| **Production Frontend Build** | `npm --prefix frontend run build` | Vite production client bundle compilation with 0 errors |

---

## 🎨 Design

- **Visual Concept**: Structured around **Previous → Current → Δ** to clarify changes between reports.
- **Theme Support**: Seamless Light and Dark modes with persistent preference storage.
- **Accessibility & Motion**: Full support for `prefers-reduced-motion: reduce` and clear focus rings for keyboard navigation.
- **Responsive Layout**: Designed for mobile, tablet, and desktop viewports.

---

## 📄 Synthetic Data Notice

All demonstration laboratory reports, patient information, facility names, and measurement values in this project are entirely synthetic and created solely for technical evaluation. They do not represent actual medical records or real individuals.

---

## 🏆 Hackathon

Built for **Hack Devengers 2.0**.
