import os
import sys
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
import io
import pymupdf
import httpx
from dotenv import load_dotenv

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
sys.path.insert(0, REPO_ROOT)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

import time
from backend.extraction import (
    call_groq_extraction,
    extract_text_from_pdf,
    normalize_extracted_date,
    detect_document_date_convention,
)
from backend.config import SUPABASE_URL, SUPABASE_ANON_KEY, GROQ_API_KEY
from supabase import create_client

def create_pdf_with_text(text: str) -> bytes:
    """Helper to generate an in-memory PDF using PyMuPDF with specified text."""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    # Insert text lines
    y = 50
    for line in text.split("\n"):
        page.insert_text((50, y), line, fontsize=11)
        y += 18
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def run_tests():
    print("=" * 70)
    print("LabΔ — PDF Metadata Extraction Test Suite")
    print("=" * 70)
    results = []

    def record(name, condition, detail=""):
        status = "PASS" if condition else "FAIL"
        results.append((name, condition, detail))
        print(f"[{status}] {name}: {detail}")

    # -------------------------------------------------------------------------
    # Unit Test: Date Normalization & Context Resolution
    # -------------------------------------------------------------------------
    try:
        assert normalize_extracted_date("15/01/2026") == "2026-01-15"
        assert normalize_extracted_date("15-01-2026") == "2026-01-15"
        assert normalize_extracted_date("15 Jan 2026") == "2026-01-15"
        assert normalize_extracted_date("January 15, 2026") == "2026-01-15"
        assert normalize_extracted_date("Jan 15, 2026") == "2026-01-15"
        assert normalize_extracted_date("2026-01-15") == "2026-01-15"
        # Ambiguous alone
        assert normalize_extracted_date("03/04/2026") is None
        # Ambiguous with DMY context (15/03/2026 appears elsewhere)
        assert normalize_extracted_date("03/04/2026", "Collected: 15/03/2026") == "2026-04-03"
        # Ambiguous with MDY context (03/15/2026 appears elsewhere)
        assert normalize_extracted_date("03/04/2026", "Collected: 03/15/2026") == "2026-03-04"
        # Invalid day
        assert normalize_extracted_date("31/02/2026") is None
        record("Date Normalizer Unit", True, "All format & ambiguity variations normalized correctly")
    except Exception as e:
        record("Date Normalizer Unit", False, str(e))

    # -------------------------------------------------------------------------
    # Test A: PDF with Lab Name + Report Date + Measurements
    # -------------------------------------------------------------------------
    text_a = """
    METRO PATHOLOGY DIAGNOSTICS
    452 Healthcare Boulevard, Suite 100
    Report Date: 15/01/2026
    Patient ID: SYNTH-001

    Test Name       Result   Unit    Reference Range
    -------------------------------------------------
    Hemoglobin      14.2     g/dL    13.0 - 17.0
    Platelets       240      k/µL    150 - 450
    """
    try:
        pdf_a = create_pdf_with_text(text_a)
        extracted_text_a = extract_text_from_pdf(pdf_a)
        data_a = call_groq_extraction(extracted_text_a)
        has_lab = data_a.lab_name and "metro" in data_a.lab_name.lower()
        has_date = data_a.report_date == "2026-01-15"
        has_meas = len(data_a.measurements) >= 2
        record("Test A: Lab + Date + Measurements", has_lab and has_date and has_meas,
               f"lab='{data_a.lab_name}', date={data_a.report_date}, meas_count={len(data_a.measurements)}")
    except Exception as e:
        record("Test A: Lab + Date + Measurements", False, str(e))

    # -------------------------------------------------------------------------
    # Test B: PDF with Lab Name + Measurements, No Date
    # -------------------------------------------------------------------------
    text_b = """
    APEX CLINICAL LABORATORIES
    Specimen Analysis Panel
    Patient ID: SYNTH-002

    Test Name       Result   Unit    Reference Range
    -------------------------------------------------
    Fasting Glucose 95       mg/dL   70 - 99
    HbA1c           5.4      %       < 5.7
    """
    try:
        pdf_b = create_pdf_with_text(text_b)
        data_b = call_groq_extraction(extract_text_from_pdf(pdf_b))
        has_lab = data_b.lab_name and "apex" in data_b.lab_name.lower()
        no_date = data_b.report_date is None
        has_meas = len(data_b.measurements) >= 2
        record("Test B: Lab + Measurements, No Date", has_lab and no_date and has_meas,
               f"lab='{data_b.lab_name}', date={data_b.report_date} (expected None), meas_count={len(data_b.measurements)}")
    except Exception as e:
        record("Test B: Lab + Measurements, No Date", False, str(e))

    # -------------------------------------------------------------------------
    # Test C: PDF with Date + Measurements, No Lab Name
    # -------------------------------------------------------------------------
    text_c = """
    Diagnostic Results Summary
    Observation Date: 2026-06-20
    Patient ID: SYNTH-003

    Test Name       Result   Unit    Reference Range
    -------------------------------------------------
    Total Calcium   9.4      mg/dL   8.5 - 10.5
    Serum Potassium 4.2      mmol/L  3.5 - 5.0
    """
    try:
        pdf_c = create_pdf_with_text(text_c)
        data_c = call_groq_extraction(extract_text_from_pdf(pdf_c))
        no_lab = data_c.lab_name is None
        has_date = data_c.report_date == "2026-06-20"
        has_meas = len(data_c.measurements) >= 2
        record("Test C: Date + Measurements, No Lab", no_lab and has_date and has_meas,
               f"lab={data_c.lab_name} (expected None), date={data_c.report_date}, meas_count={len(data_c.measurements)}")
    except Exception as e:
        record("Test C: Date + Measurements, No Lab", False, str(e))

    # -------------------------------------------------------------------------
    # Test D: PDF with Measurements Only (No Lab, No Date)
    # -------------------------------------------------------------------------
    text_d = """
    Laboratory Measurements
    Patient ID: SYNTH-004

    Test Name       Result   Unit    Reference Range
    -------------------------------------------------
    Serum Creatinine 0.9     mg/dL   0.6 - 1.2
    BUN             14       mg/dL   7 - 20
    """
    try:
        pdf_d = create_pdf_with_text(text_d)
        data_d = call_groq_extraction(extract_text_from_pdf(pdf_d))
        no_lab = data_d.lab_name is None
        no_date = data_d.report_date is None
        has_meas = len(data_d.measurements) >= 2
        record("Test D: Measurements Only", no_lab and no_date and has_meas,
               f"lab={data_d.lab_name} (None), date={data_d.report_date} (None), meas_count={len(data_d.measurements)}")
    except Exception as e:
        record("Test D: Measurements Only", False, str(e))

    # -------------------------------------------------------------------------
    # Test E: PDF with Several Unrelated Dates (DOB, Reg Date, Print Date, Report Date)
    # -------------------------------------------------------------------------
    text_e = """
    EVERGREEN DIAGNOSTIC CENTRE
    Patient DOB: 1985-04-12
    Patient Registration Date: 2026-01-02
    Appointment Date: 2026-01-05
    Specimen Collection Date: 2026-01-10
    Final Report Date: 2026-01-12
    Document Print Date: 2026-01-14
    Doctor Review Sign-off Date: 2026-01-13

    Test Name       Result   Unit    Reference Range
    -------------------------------------------------
    ALT             28       U/L     7 - 56
    AST             24       U/L     10 - 40
    """
    try:
        pdf_e = create_pdf_with_text(text_e)
        data_e = call_groq_extraction(extract_text_from_pdf(pdf_e))
        has_lab = data_e.lab_name and "evergreen" in data_e.lab_name.lower()
        # Should prioritize Final Report Date (2026-01-12) or Collection Date (2026-01-10), NOT DOB (1985) or Print Date (2026-01-14)
        is_correct_date = data_e.report_date in ("2026-01-12", "2026-01-10")
        record("Test E: Unrelated Dates Disambiguation", has_lab and is_correct_date,
               f"lab='{data_e.lab_name}', selected_date={data_e.report_date} (excluded DOB 1985-04-12 & print 2026-01-14)")
    except Exception as e:
        record("Test E: Unrelated Dates Disambiguation", False, str(e))

    # -------------------------------------------------------------------------
    # Test F: Existing Synthetic PDFs
    # -------------------------------------------------------------------------
    demo_pdf = os.path.join(REPO_ROOT, "demo_reports", "LabDelta_Demo_Report_2026-01-15_City_Labs.pdf")
    pdf_existing_path = demo_pdf if os.path.exists(demo_pdf) else os.path.join(BACKEND_DIR, "synthetic_test_pdfs", "report_a_citylabs.pdf")
    try:
        with open(pdf_existing_path, "rb") as f:
            pdf_bytes = f.read()
        extracted_text_f = extract_text_from_pdf(pdf_bytes)
        data_f = call_groq_extraction(extracted_text_f)
        has_lab_f = data_f.lab_name and "city labs" in data_f.lab_name.lower()
        has_date_f = data_f.report_date == "2026-01-15"
        record("Test F: Existing synthetic PDF (report_a_citylabs.pdf)", has_lab_f and has_date_f and len(data_f.measurements) >= 3,
               f"lab='{data_f.lab_name}', date={data_f.report_date}, meas_count={len(data_f.measurements)}")
    except Exception as e:
        record("Test F: Existing synthetic PDF", False, str(e))

    # -------------------------------------------------------------------------
    # Test G: End-to-End Save & Modification Verification
    # -------------------------------------------------------------------------
    try:
        # Simulate user receiving extracted data, editing lab name, and saving
        test_id = int(time.time() * 1000)
        test_email = f"labdelta.pdfmeta.{test_id}@gmail.com"
        test_password = "Stage7TestPassword2026!"
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        sign_up_res = client.auth.sign_up({"email": test_email, "password": test_password})
        test_user_id = sign_up_res.user.id
        client.auth.sign_in_with_password({"email": test_email, "password": test_password})

        edited_lab = "Custom Edited Lab"
        edited_date = "2026-02-20"
        
        ins_rep = client.table("reports").insert({
            "user_id": test_user_id,
            "report_date": edited_date,
            "lab_name": edited_lab,
            "source_type": "pdf"
        }).execute()
        rep_id = ins_rep.data[0]["id"]
        
        ins_meas = client.table("measurements").insert([
            {
                "report_id": rep_id,
                "test_name_raw": "Hemoglobin",
                "test_name_normalized": "hemoglobin",
                "value_numeric": 14.5,
                "unit": "g/dL",
                "reference_min": 13.0,
                "reference_max": 17.0
            }
        ]).execute()
        
        # Verify saved correctly
        check_rep = client.table("reports").select("*, measurements(*)").eq("id", rep_id).single().execute()
        saved_ok = (
            check_rep.data["lab_name"] == edited_lab and
            check_rep.data["report_date"] == edited_date and
            len(check_rep.data["measurements"]) == 1
        )
        # Cleanup
        client.table("measurements").delete().eq("report_id", rep_id).execute()
        client.table("reports").delete().eq("id", rep_id).execute()
        
        record("Test G: End-to-End Verification & Save Flow", saved_ok,
               f"Report {rep_id} saved with edited metadata and cleaned up")
    except Exception as e:
        record("Test G: End-to-End Verification & Save Flow", False, str(e))

    # Summary
    print("\n" + "=" * 70)
    passed_count = sum(1 for _, ok, _ in results if ok)
    total_count = len(results)
    print(f"PDF Metadata Results: {passed_count}/{total_count} Passed")
    print("=" * 70)
    if passed_count == total_count:
        print("ALL PDF METADATA EXTRACTION REQUIREMENTS SATISFIED.")
    else:
        print(f"WARNING: {total_count - passed_count} tests failed.")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
