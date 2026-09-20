"""
LabΔ (LabDelta) — Demo Reports PyMuPDF Verification
Verifies that all 7 synthetic demo PDF reports exist, are single-page,
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
        "units": ["g/dL", "/µL", "mg/dL", "ng/mL"],
        "refs": ["13.0 - 17.0", "4,000 - 11,000", "70 - 99", "< 200", "20 - 50"],
    },
    "LabDelta_Demo_Report_2026-02-28_Metro_Hospital.pdf": {
        "lab": "Metro General Hospital",
        "date": "February 28, 2026",
        "tests": ["Hemoglobin", "WBC Count", "Fasting Blood Glucose", "Total Cholesterol", "25-Hydroxy Vitamin D", "Platelets"],
        "values": ["13.8", "7300", "98", "205", "22", "245000"],
        "units": ["g/dL", "/µL", "mg/dL", "ng/mL"],
        "refs": ["13.5 - 17.5", "4000 - 11000", "70 - 99", "< 200", "30 - 100", "150000 - 450000"],
    },
    "LabDelta_Demo_Report_2026-04-05_Apex_Monospace.pdf": {
        "lab": "Apex Diagnostic Laboratories",
        "date": "05 Apr 2026",
        "tests": ["Hemoglobin", "WBC Count", "Fasting Glucose", "Total Cholesterol", "Vitamin D", "Platelets"],
        "values": ["13.5", "7400", "102", "198", "28", "250000"],
        "units": ["g/dL", "/µL", "mg/dL", "ng/mL"],
        "refs": ["13.0 - 17.0", "4000 - 11000", "70 - 99", "< 200", "30 - 100", "150000 - 450000"],
    },
    "LabDelta_Demo_Report_2026-05-22_HealthLab_Clinical.pdf": {
        "lab": "HealthLab Medical Diagnostics",
        "date": "22 May 2026",
        "tests": ["HGB", "WBC", "Fasting Glucose", "Total Cholesterol", "Vitamin D", "TSH"],
        "values": ["13.4", "7,200", "100", "194", "29", "3.1"],
        "units": ["g/dL", "/µL", "mg/dL", "ng/mL", "µIU/mL"],
        "refs": ["13.0 - 17.0", "4,000 - 11,000", "70 - 99", "< 200", "30 - 100", "0.4 - 4.0"],
    },
    "LabDelta_Demo_Report_2026-07-08_Summit_Endocrine.pdf": {
        "lab": "Summit Endocrine Center",
        "date": "July 08, 2026",
        "tests": ["Haemoglobin", "WBC Count", "Fasting Glucose", "Total Cholesterol", "Vitamin D", "TSH", "Urine Protein"],
        "values": ["13.2", "7,100", "105", "190", "33", "2.8", "Negative"],
        "units": ["g/dL", "/µL", "mg/dL", "ng/mL", "µIU/mL"],
        "refs": ["12.5 - 16.5", "4000 - 11000", "70 - 99", "< 200", "30 - 100", "0.4 - 4.0", "Negative"],
    },
    "LabDelta_Demo_Report_2026-08-14_CarePoint_Urgent.pdf": {
        "lab": "CarePoint Urgent Care Diagnostics",
        "date": "14 Aug 2026",
        "tests": ["Hemoglobin", "WBC Count", "Fasting Glucose", "Total Cholesterol", "Vitamin D", "Platelets"],
        "values": ["13.3", "7,000", "106", "188", "34", "246,000"],
        "units": ["g/dL", "/µL", "mg/dL", "ng/mL"],
        "refs": ["13.0 - 17.0", "4,000 - 11,000", "70 - 99", "< 200", "30 - 100", "150,000 - 450,000"],
    },
    "LabDelta_Demo_Report_2026-09-18_Redwood_Diagnostic.pdf": {
        "lab": "Redwood Diagnostic Medical Center",
        "date": "18 Sep 2026",
        "tests": ["Hemoglobin", "WBC Count", "Fasting Glucose", "Total Cholesterol", "Vitamin D", "TSH", "Platelets"],
        "values": ["13.5", "6,900", "97", "184", "35", "2.6", "248,000"],
        "units": ["g/dL", "/µL", "mg/dL", "ng/mL", "µIU/mL"],
        "refs": ["13.0 - 17.0", "4,000 - 11,000", "70 - 99", "< 200", "30 - 100", "0.4 - 4.0", "150,000 - 450,000"],
    },
}

def verify_reports():
    print("=" * 65)
    print("LabΔ — Demo Report PDFs PyMuPDF Verification (7 Multi-Format Files)")
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
            assert "SYNTHETIC DEMO REPORT" in text and "NOT A REAL MEDICAL RECORD" in text, "Missing synthetic disclaimer"

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
