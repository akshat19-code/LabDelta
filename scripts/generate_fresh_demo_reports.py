"""
LabΔ (LabDelta) — Synthetic Multi-Format Demo Report PDF Generator
Generates 7 visually distinct, realistic, single-page PDF laboratory reports
for demonstration and AI extraction testing.

Layout Formats:
1. Modern Clinical Tabular Panel (City Labs Diagnostics)
2. Hospital Health System Pathology with Flags (Metro General Hospital)
3. Classic Monospace Laboratory Printout (Apex Diagnostic Laboratories)
4. Card-Style Clinical Diagnostic Panel (HealthLab Medical Diagnostics)
5. Specialty Endocrine Two-Tone Format with Categorical Test (Summit Endocrine Center)
6. Rapid Urgent Care Stat Panel (CarePoint Urgent Care Diagnostics)
7. Comprehensive Executive Health Panel (Redwood Diagnostic Medical Center)

Safety Guarantee:
- Every document includes: SYNTHETIC DEMO REPORT — NOT A REAL MEDICAL RECORD
- Strictly no real patient PII or real medical data.
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
OUTPUT_DIR = os.path.join(REPO_ROOT, "demo_reports")
os.makedirs(OUTPUT_DIR, exist_ok=True)

DISCLAIMER = "SYNTHETIC DEMO REPORT - NOT A REAL MEDICAL RECORD"


def generate_report_1_city_labs(output_path: str):
    """Format 1: Modern Clinical Tabular Panel (City Labs)"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Top disclaimer bar
    page.draw_rect(pymupdf.Rect(36, 24, 576, 40), color=None, fill=(0.95, 0.95, 0.96))
    page.insert_text((45, 35), DISCLAIMER, fontsize=7.5, fontname="hebo", color=(0.4, 0.4, 0.45))
    page.insert_text((470, 35), "LabΔ Technical Dataset", fontsize=7.5, fontname="helv", color=(0.4, 0.4, 0.45))

    # Header banner
    page.draw_rect(pymupdf.Rect(36, 44, 576, 92), color=None, fill=(0.08, 0.16, 0.30))
    page.insert_text((50, 70), "City Labs", fontsize=16, fontname="hebo", color=(1, 1, 1))
    page.insert_text((50, 84), "Division of Clinical Pathology & Diagnostic Services", fontsize=8.5, fontname="helv", color=(0.8, 0.88, 0.95))
    page.insert_text((430, 72), "CLINICAL REPORT", fontsize=11, fontname="hebo", color=(0.3, 0.8, 0.6))

    # Demographics card
    page.draw_rect(pymupdf.Rect(36, 100, 576, 160), color=(0.82, 0.85, 0.90), fill=(0.97, 0.98, 0.99))
    page.insert_text((48, 118), "PATIENT INFORMATION", fontsize=7.5, fontname="hebo", color=(0.3, 0.35, 0.45))
    page.insert_text((48, 132), "Name: Synthetic Demo Patient", fontsize=8.5, fontname="helv")
    page.insert_text((48, 146), "ID: DEMO-PATIENT-2026", fontsize=8.5, fontname="helv")

    page.insert_text((220, 118), "SPECIMEN & ORDER", fontsize=7.5, fontname="hebo", color=(0.3, 0.35, 0.45))
    page.insert_text((220, 132), "Specimen ID: SP-2026-0115-01", fontsize=8.5, fontname="helv")
    page.insert_text((220, 146), "Specimen: Venous Blood / Serum", fontsize=8.5, fontname="helv")

    page.insert_text((420, 118), "REPORT CHRONOLOGY", fontsize=7.5, fontname="hebo", color=(0.3, 0.35, 0.45))
    page.insert_text((420, 132), "Report Date: 15 Jan 2026", fontsize=8.5, fontname="hebo")
    page.insert_text((420, 146), "Collection Date: 15 Jan 2026", fontsize=8.5, fontname="helv")

    # Table Header
    page.draw_rect(pymupdf.Rect(36, 175, 576, 195), color=None, fill=(0.90, 0.93, 0.96))
    page.insert_text((48, 189), "TEST NAME", fontsize=8, fontname="hebo", color=(0.2, 0.25, 0.35))
    page.insert_text((220, 189), "RESULT", fontsize=8, fontname="hebo", color=(0.2, 0.25, 0.35))
    page.insert_text((310, 189), "UNIT", fontsize=8, fontname="hebo", color=(0.2, 0.25, 0.35))
    page.insert_text((400, 189), "REFERENCE RANGE", fontsize=8, fontname="hebo", color=(0.2, 0.25, 0.35))

    rows = [
        ("Hemoglobin", "14.2", "g/dL", "13.0 - 17.0"),
        ("WBC Count", "7,100", "/µL", "4,000 - 11,000"),
        ("Fasting Glucose", "96", "mg/dL", "70 - 99"),
        ("Total Cholesterol", "210", "mg/dL", "< 200"),
        ("Vitamin D", "17", "ng/mL", "20 - 50"),
    ]
    y = 215
    for test, res, unit, ref in rows:
        page.insert_text((48, y), test, fontsize=9, fontname="helv")
        page.insert_text((220, y), res, fontsize=9, fontname="hebo")
        page.insert_text((310, y), unit, fontsize=9, fontname="helv")
        page.insert_text((400, y), ref, fontsize=9, fontname="helv")
        page.draw_line((36, y + 6), (576, y + 6), color=(0.88, 0.90, 0.93), width=0.5)
        y += 24

    # Methodology & Signature
    page.insert_text((48, y + 25), "METHODOLOGY & OBSERVATION NOTES", fontsize=7.5, fontname="hebo", color=(0.3, 0.35, 0.45))
    page.insert_text((48, y + 38), "Automated photometric and chemiluminescent immunoassay analysis performed in accordance with standard protocols.", fontsize=8, fontname="helv")

    page.draw_rect(pymupdf.Rect(36, y + 60, 576, y + 105), color=(0.85, 0.87, 0.90), fill=(0.98, 0.98, 0.99))
    page.insert_text((48, y + 78), "Laboratory Director: Elizabeth Warren, MD, FCAP", fontsize=8.5, fontname="hebo")
    page.insert_text((48, y + 92), "Electronically signed & released on 15 Jan 2026 via LabDelta Secure LIS Interface", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))
    page.insert_text((470, y + 84), "[DIGITALLY VERIFIED]", fontsize=8, fontname="hebo", color=(0.2, 0.6, 0.4))

    doc.save(output_path)
    doc.close()


def generate_report_2_metro_hospital(output_path: str):
    """Format 2: Hospital Health System Pathology with Flags (Metro General Hospital)"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Top disclaimer
    page.insert_text((50, 32), DISCLAIMER, fontsize=7.5, fontname="helv", color=(0.5, 0.5, 0.5))

    # Hospital Letterhead
    page.insert_text((50, 55), "METRO GENERAL HEALTH SYSTEM", fontsize=15, fontname="tibo", color=(0.1, 0.25, 0.45))
    page.insert_text((50, 70), "Department of Pathology & Clinical Laboratory Medicine", fontsize=9.5, fontname="tiro")
    page.insert_text((50, 82), "1000 Hospital Drive, Medical District | Director: Dr. J. R. Miller, MD, FCAP", fontsize=8, fontname="tiro", color=(0.4, 0.4, 0.4))
    page.draw_line((50, 90), (562, 90), color=(0.1, 0.25, 0.45), width=1.5)

    # Demographics
    page.insert_text((50, 110), "Laboratory: Metro General Hospital", fontsize=8.5, fontname="hebo")
    page.insert_text((50, 124), "Patient: Synthetic Demo Patient", fontsize=8.5, fontname="helv")
    page.insert_text((50, 138), "Medical Record No: MRN-9482019-B", fontsize=8.5, fontname="helv")

    page.insert_text((340, 110), "Report Date: February 28, 2026", fontsize=8.5, fontname="hebo")
    page.insert_text((340, 124), "Specimen Collected: 28 Feb 2026 08:30 AM", fontsize=8.5, fontname="helv")
    page.insert_text((340, 138), "Report Status: Final Certified Record", fontsize=8.5, fontname="helv")

    # Section Header
    page.draw_rect(pymupdf.Rect(50, 160, 562, 180), color=None, fill=(0.92, 0.94, 0.97))
    page.insert_text((56, 174), "GENERAL METABOLIC & HEMATOLOGY PANEL", fontsize=9.5, fontname="hebo", color=(0.1, 0.2, 0.4))

    # Monospace Table Header with Flag Column
    headers = "Test Description              Result   Flag    Reference Range    Units"
    page.insert_text((56, 198), headers, fontsize=8.5, fontname="cobo")
    page.draw_line((50, 204), (562, 204), color=(0.6, 0.65, 0.7), width=0.8)

    rows = [
        "Hemoglobin                    13.8             13.5 - 17.5        g/dL",
        "WBC Count                     7300             4000 - 11000       /µL",
        "Fasting Blood Glucose         98               70 - 99            mg/dL",
        "Total Cholesterol             205      [H]     < 200              mg/dL",
        "25-Hydroxy Vitamin D          22       [L]     30 - 100           ng/mL",
        "Platelets                     245000           150000 - 450000    /µL",
    ]
    y = 224
    for r in rows:
        page.insert_text((56, y), r, fontsize=8.5, fontname="cour")
        y += 20

    page.draw_line((50, y + 10), (562, y + 10), color=(0.7, 0.7, 0.7), width=0.5)
    page.insert_text((56, y + 25), "Flags: [H] = Above provided reference interval; [L] = Below provided reference interval.", fontsize=8, fontname="tiro", color=(0.4, 0.4, 0.4))
    page.insert_text((56, y + 42), "Authorized by: J. R. Miller, MD, FCAP (Pathologist on duty)", fontsize=8.5, fontname="tiro")

    doc.save(output_path)
    doc.close()


def generate_report_3_apex_monospace(output_path: str):
    """Format 3: Classic Monospace Laboratory Printout (Apex Diagnostic Laboratories)"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    text = f"""======================================================================
{DISCLAIMER}
======================================================================
APEX DIAGNOSTIC LABORATORIES
REGIONAL PATHOLOGY CENTRE - SPECIMEN ANALYSIS REPORT
CLIA LICENSE: 36D0891240 | ACCREDITATION: CAP #491028
======================================================================
LABORATORY NAME : Apex Diagnostic Laboratories
ACCESSION NO    : APX-2026-0405
PATIENT ID      : DEMO-PATIENT-2026
SAMPLE SOURCE   : Venous Blood / Fasting Serum
ORDERING DR     : Dr. Sarah Jenkins, MD
SPECIMEN DATE   : 05 Apr 2026
REPORT DATE     : 05 Apr 2026
VERIFICATION    : ELECTRONICALLY SIGNED & VERIFIED
----------------------------------------------------------------------
ANALYTE                   RESULT       UNITS        REFERENCE INTERVAL
----------------------------------------------------------------------
Hemoglobin                13.5         g/dL         13.0 - 17.0
WBC Count                 7400         /µL          4000 - 11000
Fasting Glucose           102          mg/dL        70 - 99
Total Cholesterol         198          mg/dL        < 200
Vitamin D                 28           ng/mL        30 - 100
Platelets                 250000       /µL          150000 - 450000
----------------------------------------------------------------------
INSTRUMENTATION : Sysmex XN-1000 / Roche cobas 8000
REMARKS         : Fasting state confirmed. Specimen integrity verified.
LAB DIRECTOR    : Marcus Vance, MD, PhD, FCAP
CONFIDENTIAL TECHNICAL DEMO RECORD — PAGE 1 OF 1
======================================================================
"""
    y = 50
    for line in text.split("\n"):
        page.insert_text((45, y), line, fontsize=8.5, fontname="cour")
        y += 15

    doc.save(output_path)
    doc.close()


def generate_report_4_healthlab_card(output_path: str):
    """Format 4: Card-Style Diagnostic Panel (HealthLab Medical Diagnostics)"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Top disclaimer
    page.insert_text((45, 32), DISCLAIMER, fontsize=7.5, fontname="helv", color=(0.45, 0.45, 0.5))

    # Violet/Indigo Modern Header Banner
    page.draw_rect(pymupdf.Rect(36, 42, 576, 95), color=None, fill=(0.36, 0.25, 0.88))
    page.insert_text((52, 70), "HealthLab Medical Diagnostics", fontsize=15, fontname="hebo", color=(1, 1, 1))
    page.insert_text((52, 85), "Advanced Clinical Laboratory & Diagnostic Services", fontsize=8.5, fontname="helv", color=(0.9, 0.88, 1))
    page.insert_text((440, 72), "PANEL RESULTS", fontsize=11, fontname="hebo", color=(0.85, 0.82, 1))

    # Card Block
    page.draw_rect(pymupdf.Rect(36, 105, 576, 160), color=(0.85, 0.82, 0.95), fill=(0.98, 0.97, 1.0))
    page.insert_text((50, 122), "Facility: HealthLab Medical Diagnostics", fontsize=8.5, fontname="hebo")
    page.insert_text((50, 136), "Patient: Synthetic Demo Patient", fontsize=8.5, fontname="helv")
    page.insert_text((50, 150), "Specimen: Fasting Venipuncture", fontsize=8.5, fontname="helv")

    page.insert_text((380, 122), "Report Date: 22 May 2026", fontsize=8.5, fontname="hebo")
    page.insert_text((380, 136), "Collection Date: 22 May 2026", fontsize=8.5, fontname="helv")
    page.insert_text((380, 150), "LIS Order No: HL-2026-0522", fontsize=8.5, fontname="helv")

    # Table Header
    page.draw_rect(pymupdf.Rect(36, 175, 576, 195), color=None, fill=(0.92, 0.90, 0.98))
    page.insert_text((50, 189), "BIOMARKER", fontsize=8, fontname="hebo", color=(0.3, 0.2, 0.6))
    page.insert_text((220, 189), "VALUE", fontsize=8, fontname="hebo", color=(0.3, 0.2, 0.6))
    page.insert_text((310, 189), "UNIT", fontsize=8, fontname="hebo", color=(0.3, 0.2, 0.6))
    page.insert_text((400, 189), "STANDARD RANGE", fontsize=8, fontname="hebo", color=(0.3, 0.2, 0.6))

    rows = [
        ("HGB", "13.4", "g/dL", "13.0 - 17.0"),
        ("WBC", "7,200", "/µL", "4,000 - 11,000"),
        ("Fasting Glucose", "100", "mg/dL", "70 - 99"),
        ("Total Cholesterol", "194", "mg/dL", "< 200"),
        ("Vitamin D", "29", "ng/mL", "30 - 100"),
        ("TSH", "3.1", "µIU/mL", "0.4 - 4.0"),
    ]
    y = 215
    for idx, (test, res, unit, ref) in enumerate(rows):
        if idx % 2 == 1:
            page.draw_rect(pymupdf.Rect(36, y - 12, 576, y + 8), color=None, fill=(0.97, 0.96, 0.99))
        page.insert_text((50, y), test, fontsize=9, fontname="helv")
        page.insert_text((220, y), res, fontsize=9, fontname="hebo")
        page.insert_text((310, y), unit, fontsize=9, fontname="helv")
        page.insert_text((400, y), ref, fontsize=9, fontname="helv")
        y += 22

    page.draw_line((36, y + 10), (576, y + 10), color=(0.85, 0.82, 0.95), width=0.5)
    page.insert_text((50, y + 26), "Certified by: Nathan Drake, PhD, HCLD | Clinical Diagnostic Supervisor", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))

    doc.save(output_path)
    doc.close()


def generate_report_5_summit_endocrine(output_path: str):
    """Format 5: Specialty Endocrine Two-Tone with Categorical Test (Summit Endocrine Center)"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Top disclaimer
    page.insert_text((45, 30), DISCLAIMER, fontsize=7.5, fontname="helv", color=(0.4, 0.5, 0.5))

    # Teal Banner
    page.draw_rect(pymupdf.Rect(36, 40, 576, 88), color=None, fill=(0.06, 0.42, 0.42))
    page.insert_text((50, 65), "SUMMIT ENDOCRINE & METABOLIC CENTER", fontsize=14, fontname="hebo", color=(1, 1, 1))
    page.insert_text((50, 78), "Specialized Hormone, Thyroid & Comprehensive Metabolic Testing", fontsize=8.5, fontname="helv", color=(0.85, 0.95, 0.95))
    page.insert_text((430, 68), "SPECIALTY REPORT", fontsize=10, fontname="hebo", color=(0.7, 1.0, 0.9))

    # Demographics Frame
    page.draw_rect(pymupdf.Rect(36, 96, 576, 148), color=(0.75, 0.85, 0.85), fill=(0.94, 0.98, 0.98))
    page.insert_text((50, 114), "Laboratory: Summit Endocrine Center", fontsize=8.5, fontname="hebo")
    page.insert_text((50, 128), "Patient: Synthetic Demo Patient", fontsize=8.5, fontname="helv")
    page.insert_text((50, 140), "Clinical Protocol: Comprehensive Metabolic Panel", fontsize=8, fontname="helv", color=(0.3, 0.4, 0.4))

    page.insert_text((370, 114), "Report Date: July 08, 2026", fontsize=8.5, fontname="hebo")
    page.insert_text((370, 128), "Collection Date: July 08, 2026", fontsize=8.5, fontname="helv")
    page.insert_text((370, 140), "Specimen: Serum & Clean Catch Urine", fontsize=8, fontname="helv", color=(0.3, 0.4, 0.4))

    # Table Header
    page.draw_rect(pymupdf.Rect(36, 160, 576, 180), color=None, fill=(0.85, 0.92, 0.92))
    page.insert_text((48, 174), "BIOMARKER NAME", fontsize=8, fontname="hebo", color=(0.1, 0.35, 0.35))
    page.insert_text((215, 174), "RESULT", fontsize=8, fontname="hebo", color=(0.1, 0.35, 0.35))
    page.insert_text((305, 174), "UNIT", fontsize=8, fontname="hebo", color=(0.1, 0.35, 0.35))
    page.insert_text((395, 174), "TARGET INTERVAL", fontsize=8, fontname="hebo", color=(0.1, 0.35, 0.35))

    rows = [
        ("Haemoglobin", "13.2", "g/dL", "12.5 - 16.5"),
        ("WBC Count", "7,100", "/µL", "4000 - 11000"),
        ("Fasting Glucose", "105", "mg/dL", "70 - 99"),
        ("Total Cholesterol", "190", "mg/dL", "< 200"),
        ("Vitamin D", "33", "ng/mL", "30 - 100"),
        ("TSH", "2.8", "µIU/mL", "0.4 - 4.0"),
        ("Urine Protein", "Negative", "-", "Negative"),
    ]
    y = 200
    for name, val, unit, ref in rows:
        page.insert_text((48, y), name, fontsize=8.5, fontname="helv")
        page.insert_text((215, y), val, fontsize=8.5, fontname="hebo")
        page.insert_text((305, y), unit, fontsize=8.5, fontname="helv")
        page.insert_text((395, y), ref, fontsize=8.5, fontname="helv")
        page.draw_line((36, y + 4), (576, y + 4), color=(0.85, 0.90, 0.90), width=0.5)
        y += 20

    page.insert_text((48, y + 25), "Endocrine Consultation: Results verified electronically by Dr. Rebecca Vance, MD, FACE.", fontsize=8, fontname="helv", color=(0.3, 0.4, 0.4))

    doc.save(output_path)
    doc.close()


def generate_report_6_carepoint_urgent(output_path: str):
    """Format 6: Rapid Urgent Care Stat Panel (CarePoint Urgent Care Rapid Diagnostics)"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Top disclaimer
    page.insert_text((45, 30), DISCLAIMER, fontsize=7.5, fontname="helv", color=(0.5, 0.4, 0.4))

    # Amber / Coral Accent Header
    page.draw_rect(pymupdf.Rect(36, 40, 576, 88), color=None, fill=(0.75, 0.25, 0.15))
    page.insert_text((50, 65), "CAREPOINT URGENT CARE & DIAGNOSTICS", fontsize=14, fontname="hebo", color=(1, 1, 1))
    page.insert_text((50, 78), "Rapid Response Specimen Processing Unit • STAT Services", fontsize=8.5, fontname="helv", color=(1.0, 0.9, 0.88))
    page.insert_text((460, 68), "STAT LAB", fontsize=10, fontname="hebo", color=(1, 0.9, 0.5))

    # Demographics Block
    page.draw_rect(pymupdf.Rect(36, 96, 576, 150), color=(0.9, 0.8, 0.75), fill=(0.99, 0.97, 0.96))
    page.insert_text((50, 114), "Laboratory: CarePoint Urgent Care Diagnostics", fontsize=8.5, fontname="hebo")
    page.insert_text((50, 128), "Patient: Synthetic Demo Patient", fontsize=8.5, fontname="helv")
    page.insert_text((50, 140), "Encounter Type: Urgent Ambulatory Visit", fontsize=8, fontname="helv", color=(0.4, 0.3, 0.3))

    page.insert_text((370, 114), "Report Date: 14 Aug 2026", fontsize=8.5, fontname="hebo")
    page.insert_text((370, 128), "Sample Collected: 14 Aug 2026 11:15 AM", fontsize=8.5, fontname="helv")
    page.insert_text((370, 140), "Priority: STAT Standard Turnaround", fontsize=8, fontname="helv", color=(0.4, 0.3, 0.3))

    # Table Header
    page.draw_rect(pymupdf.Rect(36, 162, 576, 182), color=None, fill=(0.95, 0.90, 0.88))
    page.insert_text((48, 176), "ANALYTE DESCRIPTION", fontsize=8, fontname="hebo", color=(0.4, 0.15, 0.1))
    page.insert_text((220, 176), "RESULT", fontsize=8, fontname="hebo", color=(0.4, 0.15, 0.1))
    page.insert_text((310, 176), "UNIT", fontsize=8, fontname="hebo", color=(0.4, 0.15, 0.1))
    page.insert_text((400, 176), "REFERENCE LIMITS", fontsize=8, fontname="hebo", color=(0.4, 0.15, 0.1))

    rows = [
        ("Hemoglobin", "13.3", "g/dL", "13.0 - 17.0"),
        ("WBC Count", "7,000", "/µL", "4,000 - 11,000"),
        ("Fasting Glucose", "106", "mg/dL", "70 - 99"),
        ("Total Cholesterol", "188", "mg/dL", "< 200"),
        ("Vitamin D", "34", "ng/mL", "30 - 100"),
        ("Platelets", "246,000", "/µL", "150,000 - 450,000"),
    ]
    y = 202
    for test, res, unit, ref in rows:
        page.insert_text((48, y), test, fontsize=8.5, fontname="helv")
        page.insert_text((220, y), res, fontsize=8.5, fontname="hebo")
        page.insert_text((310, y), unit, fontsize=8.5, fontname="helv")
        page.insert_text((400, y), ref, fontsize=8.5, fontname="helv")
        page.draw_line((36, y + 4), (576, y + 4), color=(0.92, 0.88, 0.85), width=0.5)
        y += 20

    page.insert_text((48, y + 25), "CarePoint Rapid Verification: Automated point-of-care and benchtop verified.", fontsize=8, fontname="helv", color=(0.4, 0.3, 0.3))

    doc.save(output_path)
    doc.close()


def generate_report_7_redwood_diagnostic(output_path: str):
    """Format 7: Comprehensive Executive Health Panel (Redwood Diagnostic Medical Center)"""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)

    # Top disclaimer
    page.insert_text((45, 30), DISCLAIMER, fontsize=7.5, fontname="helv", color=(0.35, 0.45, 0.35))

    # Emerald Executive Banner
    page.draw_rect(pymupdf.Rect(36, 40, 576, 92), color=None, fill=(0.10, 0.35, 0.25))
    page.insert_text((50, 66), "Redwood Diagnostic Medical Center", fontsize=15, fontname="hebo", color=(1, 1, 1))
    page.insert_text((50, 80), "Executive Health, Pathology & Preventive Diagnostics Division", fontsize=8.5, fontname="helv", color=(0.85, 0.95, 0.90))
    page.insert_text((440, 68), "ANNUAL PANEL", fontsize=10, fontname="hebo", color=(0.6, 0.95, 0.75))

    # Demographics Card
    page.draw_rect(pymupdf.Rect(36, 100, 576, 154), color=(0.80, 0.88, 0.82), fill=(0.96, 0.99, 0.97))
    page.insert_text((50, 118), "Laboratory: Redwood Diagnostic Medical Center", fontsize=8.5, fontname="hebo")
    page.insert_text((50, 132), "Patient: Synthetic Demo Patient", fontsize=8.5, fontname="helv")
    page.insert_text((50, 144), "Physician: Dr. Kenneth Clark, MD (Executive Health)", fontsize=8, fontname="helv", color=(0.3, 0.4, 0.35))

    page.insert_text((370, 118), "Report Date: 18 Sep 2026", fontsize=8.5, fontname="hebo")
    page.insert_text((370, 132), "Collected: 18 Sep 2026 07:45 AM", fontsize=8.5, fontname="helv")
    page.insert_text((370, 144), "Accreditation: ISO 15189 Certified", fontsize=8, fontname="helv", color=(0.3, 0.4, 0.35))

    # Table Header
    page.draw_rect(pymupdf.Rect(36, 166, 576, 186), color=None, fill=(0.88, 0.94, 0.90))
    page.insert_text((48, 180), "MEASUREMENT", fontsize=8, fontname="hebo", color=(0.1, 0.35, 0.2))
    page.insert_text((220, 180), "RESULT", fontsize=8, fontname="hebo", color=(0.1, 0.35, 0.2))
    page.insert_text((310, 180), "UNIT", fontsize=8, fontname="hebo", color=(0.1, 0.35, 0.2))
    page.insert_text((400, 180), "REFERENCE BOUNDS", fontsize=8, fontname="hebo", color=(0.1, 0.35, 0.2))

    rows = [
        ("Hemoglobin", "13.5", "g/dL", "13.0 - 17.0"),
        ("WBC Count", "6,900", "/µL", "4,000 - 11,000"),
        ("Fasting Glucose", "97", "mg/dL", "70 - 99"),
        ("Total Cholesterol", "184", "mg/dL", "< 200"),
        ("Vitamin D", "35", "ng/mL", "30 - 100"),
        ("TSH", "2.6", "µIU/mL", "0.4 - 4.0"),
        ("Platelets", "248,000", "/µL", "150,000 - 450,000"),
    ]
    y = 206
    for test, res, unit, ref in rows:
        page.insert_text((48, y), test, fontsize=8.5, fontname="helv")
        page.insert_text((220, y), res, fontsize=8.5, fontname="hebo")
        page.insert_text((310, y), unit, fontsize=8.5, fontname="helv")
        page.insert_text((400, y), ref, fontsize=8.5, fontname="helv")
        page.draw_line((36, y + 4), (576, y + 4), color=(0.88, 0.92, 0.89), width=0.5)
        y += 20

    # Authorization
    page.insert_text((48, y + 25), "Electronically authorized by: Arthur Pendelton, MD, Clinical Laboratory Director", fontsize=8, fontname="helv", color=(0.3, 0.4, 0.35))

    doc.save(output_path)
    doc.close()


def generate_all():
    generators = [
        ("LabDelta_Demo_Report_2026-01-15_City_Labs.pdf", generate_report_1_city_labs),
        ("LabDelta_Demo_Report_2026-02-28_Metro_Hospital.pdf", generate_report_2_metro_hospital),
        ("LabDelta_Demo_Report_2026-04-05_Apex_Monospace.pdf", generate_report_3_apex_monospace),
        ("LabDelta_Demo_Report_2026-05-22_HealthLab_Clinical.pdf", generate_report_4_healthlab_card),
        ("LabDelta_Demo_Report_2026-07-08_Summit_Endocrine.pdf", generate_report_5_summit_endocrine),
        ("LabDelta_Demo_Report_2026-08-14_CarePoint_Urgent.pdf", generate_report_6_carepoint_urgent),
        ("LabDelta_Demo_Report_2026-09-18_Redwood_Diagnostic.pdf", generate_report_7_redwood_diagnostic),
    ]

    print("=" * 70)
    print("Generating 7 Multi-Format Synthetic Demo Reports in demo_reports/")
    print("=" * 70)

    for fname, func in generators:
        out_path = os.path.join(OUTPUT_DIR, fname)
        func(out_path)
        sz_kb = round(os.path.getsize(out_path) / 1024, 1)
        print(f"[OK] Generated {fname} ({sz_kb} KB)")

    print("-" * 70)
    print("All 7 demo reports generated successfully.")


if __name__ == "__main__":
    generate_all()
