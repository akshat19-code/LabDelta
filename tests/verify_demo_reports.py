"""
LabΔ (LabDelta) — Demo Reports PyMuPDF Verification
Verifies that all 4 synthetic demo PDF reports exist, are single-page,
contain extractable text, and match the exact specification.
"""

import os
import sys
import pymupdf

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPORTS_DIR = os.path.join(REPO_ROOT, "demo_reports")

EXPECTED_REPORTS = {
    "LabDelta_Demo_Report_2026-01-15_City_Labs.pdf": {
        "lab": "City Labs",
        "date": "15 Jan 2026",
        "tests": ["Hemoglobin", "WBC Count", "Fasting Glucose", "Total Cholesterol", "Vitamin D"],
        "values": ["14.2", "7,100", "96", "210", "17"],
        "units": ["g/dL", "/µL", "mg/dL", "mg/dL", "ng/mL"],
        "refs": ["13.0–17.0", "4,000–11,000", "70–99", "<200", "20–50"],
    },
    "LabDelta_Demo_Report_2026-04-15_HealthLab.pdf": {
        "lab": "HealthLab",
        "date": "15 Apr 2026",
        "tests": ["HGB", "WBC", "Fasting Glucose", "Total Cholesterol", "Vitamin D"],
        "values": ["13.8", "7,300", "98", "195", "21"],
        "units": ["g/dL", "/µL", "mg/dL", "mg/dL", "ng/mL"],
        "refs": ["13.5–17.5", "4,000–11,000", "70–99", "<200", "20–50"],
    },
    "LabDelta_Demo_Report_2026-07-15_Demo_Diagnostics.pdf": {
        "lab": "Demo Diagnostics",
        "date": "15 Jul 2026",
        "tests": ["Hemoglobin", "WBC Count", "Fasting Glucose", "Vitamin D", "Urine Protein"],
        "values": ["13.8", "7,600", "104", "52", "Negative"],
        "units": ["g/dL", "/µL", "mg/dL", "nmol/L"],
        "refs": ["13.5–17.5", "4,000–11,000", "70–99", "75–250", "Negative"],
    },
    "LabDelta_Demo_Report_2026-09-15_City_Labs.pdf": {
        "lab": "City Labs",
        "date": "15 Sep 2026",
        "tests": ["Hemoglobin", "WBC Count", "Fasting Glucose", "Vitamin D", "TSH"],
        "values": ["12.8", "6,900", "108", "32", "3.2"],
        "units": ["g/dL", "/µL", "mg/dL", "ng/mL", "µIU/mL"],
        "refs": ["13.0–17.0", "4,000–11,000", "70–99", "20–50", "0.4–4.0"],
    },
}

def verify_reports():
    print("=" * 65)
    print("LabΔ — Demo Report PDFs PyMuPDF Verification")
    print("=" * 65)
    
    passed = 0
    failed = 0

    for fname, exp in EXPECTED_REPORTS.items():
        fpath = os.path.join(REPORTS_DIR, fname)
        if not os.path.exists(fpath):
            print(f"[FAIL] Missing file: {fname}")
            failed += 1
            continue

        try:
            doc = pymupdf.open(fpath)
            if doc.page_count != 1:
                print(f"[FAIL] {fname}: Page count is {doc.page_count}, expected 1")
                failed += 1
                continue

            text = doc[0].get_text("text").replace("\xa0", " ")

            # Prominent synthetic disclaimer
            assert "SYNTHETIC DEMO REPORT — NOT A REAL MEDICAL RECORD" in text, "Missing synthetic disclaimer"

            # Lab Name & Report Date
            assert exp["lab"] in text, f"Missing laboratory: {exp['lab']}"
            assert exp["date"] in text, f"Missing report date: {exp['date']}"

            # All measurements, values, units, and ranges
            for t in exp["tests"]:
                assert t in text, f"Missing test: {t}"
            for v in exp["values"]:
                assert v in text, f"Missing value: {v}"
            for u in exp["units"]:
                assert u in text, f"Missing unit: {u}"
            for r in exp["refs"]:
                assert r in text, f"Missing ref range: {r}"

            sz_kb = round(os.path.getsize(fpath) / 1024, 1)
            print(f"[PASS] {fname} ({sz_kb} KB, 1 page) — text & metadata verified")
            passed += 1
        except Exception as exc:
            print(f"[FAIL] {fname}: {exc}")
            failed += 1

    print("-" * 65)
    print(f"Summary: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    verify_reports()
