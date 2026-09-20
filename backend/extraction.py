import datetime
import json
import re
from typing import List, Optional
import pymupdf
from groq import APIError, APITimeoutError, Groq, RateLimitError
from pydantic import BaseModel, Field

from backend.config import GROQ_API_KEY


class ExtractedMeasurement(BaseModel):
    test_name: str
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    reference_min: Optional[float] = None
    reference_max: Optional[float] = None
    reference_text: Optional[str] = None


class ExtractedReportData(BaseModel):
    report_date: Optional[str] = None
    lab_name: Optional[str] = None
    measurements: List[ExtractedMeasurement] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}


def detect_document_date_convention(doc_text: Optional[str]) -> Optional[str]:
    """Scans the document text for unambiguous dates to determine if the report uses DD/MM or MM/DD convention."""
    if not doc_text:
        return None

    # Check for explicit format markers in headers/legends
    if re.search(r"\bdd[/.-]mm[/.-]yyyy\b", doc_text, re.IGNORECASE):
        return "DMY"
    if re.search(r"\bmm[/.-]dd[/.-]yyyy\b", doc_text, re.IGNORECASE):
        return "MDY"

    # Scan numeric dates in the document
    matches = re.findall(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", doc_text)
    dmy_votes = 0
    mdy_votes = 0
    for n1_s, n2_s, _ in matches:
        n1, n2 = int(n1_s), int(n2_s)
        if n1 > 12 and 1 <= n2 <= 12:
            dmy_votes += 1
        elif 1 <= n1 <= 12 and n2 > 12:
            mdy_votes += 1

    if dmy_votes > 0 and mdy_votes == 0:
        return "DMY"
    if mdy_votes > 0 and dmy_votes == 0:
        return "MDY"
    return None


def normalize_extracted_date(date_str: Optional[str], doc_text: Optional[str] = None) -> Optional[str]:
    """Safely normalizes an extracted date string to standard ISO YYYY-MM-DD.
    If ambiguous without clear document context, returns None so the user can verify."""
    if not date_str or not isinstance(date_str, str):
        return None

    s = date_str.strip().strip("\"'`").strip()
    if not s or s.lower() == "null" or s.lower() == "none":
        return None

    # 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
    m_iso = re.search(r"\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b", s)
    if m_iso:
        y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        try:
            return datetime.date(y, m, d).isoformat()
        except ValueError:
            return None

    # 2. Textual month format: DD Mon YYYY (e.g. 15 Jan 2026, 15th January, 2026)
    m_text1 = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?[\s\-/,]+([A-Za-z]+)[\s\-/,]+(\d{4})\b", s)
    if m_text1:
        d = int(m_text1.group(1))
        m_name = m_text1.group(2).lower()
        y = int(m_text1.group(3))
        if m_name in MONTH_MAP:
            try:
                return datetime.date(y, MONTH_MAP[m_name], d).isoformat()
            except ValueError:
                return None

    # 3. Textual month format: Mon DD, YYYY (e.g. January 15, 2026, Jan 15 2026)
    m_text2 = re.search(r"\b([A-Za-z]+)[\s\-/,]+(\d{1,2})(?:st|nd|rd|th)?[\s\-/,]+(\d{4})\b", s)
    if m_text2:
        m_name = m_text2.group(1).lower()
        d = int(m_text2.group(2))
        y = int(m_text2.group(3))
        if m_name in MONTH_MAP:
            try:
                return datetime.date(y, MONTH_MAP[m_name], d).isoformat()
            except ValueError:
                return None

    # 4. Numeric date format: D/M/Y or M/D/Y
    m_num = re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", s)
    if m_num:
        n1, n2, y = int(m_num.group(1)), int(m_num.group(2)), int(m_num.group(3))
        if n1 > 12 and 1 <= n2 <= 12:
            # Unambiguously Day / Month / Year
            try:
                return datetime.date(y, n2, n1).isoformat()
            except ValueError:
                return None
        elif 1 <= n1 <= 12 and n2 > 12:
            # Unambiguously Month / Day / Year
            try:
                return datetime.date(y, n1, n2).isoformat()
            except ValueError:
                return None
        elif n1 == n2 and 1 <= n1 <= 12:
            # Identical day and month (e.g. 05/05/2026)
            try:
                return datetime.date(y, n1, n2).isoformat()
            except ValueError:
                return None
        elif 1 <= n1 <= 12 and 1 <= n2 <= 12:
            # Ambiguous (e.g. 03/04/2026): inspect document context evidence
            conv = detect_document_date_convention(doc_text) if doc_text else None
            if conv == "DMY":
                try:
                    return datetime.date(y, n2, n1).isoformat()
                except ValueError:
                    return None
            elif conv == "MDY":
                try:
                    return datetime.date(y, n1, n2).isoformat()
                except ValueError:
                    return None
            else:
                # No strong contextual proof; return None for user verification
                return None

    return None


SYSTEM_PROMPT = """You are a strict clinical laboratory report data extraction engine.
Your ONLY role is information extraction from the provided laboratory report text.

CRITICAL RULES:
1. Extract ONLY information explicitly present in the report text.
2. If any field is absent or uncertain, return null rather than guessing.
3. NEVER diagnose, interpret, or recommend treatment.
4. NEVER invent reference ranges, units, missing measurements, or report metadata.
5. NEVER correct or normalize test names; preserve the exact raw wording in the report (e.g., "HGB", "FBS", "Serum XYZ Marker").
6. For values:
   - If numeric, set value_numeric to the float/int and value_text to null.
   - If categorical/textual (e.g., "Positive", "Negative", "Borderline", "Detected"), set value_text to the exact text and value_numeric to null.
7. For reference ranges:
   - If explicit numeric bounds exist (e.g., "13 - 17"), set reference_min and reference_max to numbers.
   - If threshold text or qualitative (e.g., "< 200", "> 40", "Negative"), set reference_text and do NOT invent bounds.

REPORT METADATA EXTRACTION RULES:
8. Laboratory Name ("lab_name"):
   - Identify the diagnostic facility, pathology laboratory, or medical testing centre name (typically found in document headers, logos, facility contact info, or preceded by "Laboratory", "Diagnostics", "Pathology", "HealthLab").
   - Preserve the authentic display name and capitalization (e.g., "City Labs Diagnostics", "Metro Pathology Centre").
   - Strictly DO NOT confuse the laboratory name with:
     * Patient name (e.g., "John Doe", "Patient Name: ...")
     * Ordering physician or doctor name (e.g., "Dr. Smith", "Ref By: ...")
     * Hospital department or ward (e.g., "Hematology Dept", "OPD")
     * Test panel or profile name (e.g., "Complete Blood Count", "Lipid Profile")
   - If the laboratory name cannot be confidently identified, return null. NEVER invent facility names.

9. Report Date ("report_date"):
   - Extract the date corresponding to the laboratory report or observation.
   - Date priority order:
     1. Report Date / Final Report Date / Authorized Date
     2. Result Date / Completed Date
     3. Collection Date / Specimen Date / Sample Date
   - Strictly DO NOT select:
     * Patient Date of Birth (DOB)
     * Patient Registration / Admission Date
     * Billing / Invoice Date
     * Document Print Date / Generated Date
     * Doctor Signature / Review Date
     unless that date is explicitly also identified as the report or result date.
   - If multiple dates exist, choose the date genuinely representing the laboratory report or specimen collection.
   - If the report date cannot be confidently identified, return null. NEVER invent dates.

10. Privacy:
    - DO NOT extract patient names, patient IDs, addresses, or personal contact details.

11. Output MUST be valid JSON adhering strictly to the schema."""


USER_PROMPT_TEMPLATE = """Extract the lab report metadata and all measured test biomarkers from this report text:

--- BEGIN REPORT TEXT ---
{report_text}
--- END REPORT TEXT ---

Return a JSON object with this exact structure:
{{
  "report_date": "Extracted report or collection date (e.g., YYYY-MM-DD or DD/MM/YYYY or 15 Jan 2026) or null",
  "lab_name": "Authentic laboratory display name or null",
  "measurements": [
    {{
      "test_name": "Exact raw test name",
      "value_numeric": 12.3 or null,
      "value_text": "Textual result or null",
      "unit": "Unit string or null",
      "reference_min": 10.0 or null,
      "reference_max": 20.0 or null,
      "reference_text": "Threshold or text range or null"
    }}
  ]
}}
"""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts raw text from all pages of an in-memory PDF using PyMuPDF."""
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Corrupted or invalid PDF file: {str(exc)}")

    if doc.page_count == 0:
        raise ValueError("PDF document contains no pages.")

    pages_text = []
    for page_num in range(doc.page_count):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        if text:
            pages_text.append(text)

    full_text = "\n".join(pages_text).strip()
    return full_text


def call_groq_extraction(report_text: str) -> ExtractedReportData:
    """Sends sanitized report text to Groq and validates the extracted structured JSON."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured on the server.")

    client = Groq(api_key=GROQ_API_KEY)
    model = "openai/gpt-oss-20b"

    prompt_content = USER_PROMPT_TEMPLATE.format(report_text=report_text)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )
    except RateLimitError as exc:
        raise RuntimeError("Groq API rate limit reached. Please try again shortly.")
    except APITimeoutError as exc:
        raise RuntimeError("Groq request timed out. Please try again.")
    except APIError as exc:
        raise RuntimeError(f"Groq extraction service error: {str(exc)}")
    except Exception as exc:
        raise RuntimeError(f"Failed to communicate with AI extraction service: {str(exc)}")

    raw_content = response.choices[0].message.content
    if not raw_content:
        raise RuntimeError("AI extraction returned an empty response.")

    # Strip markdown fences if present
    cleaned_json_str = raw_content.strip()
    if cleaned_json_str.startswith("```"):
        cleaned_json_str = re.sub(r"^```(?:json)?\n?", "", cleaned_json_str)
        cleaned_json_str = re.sub(r"\n?```$", "", cleaned_json_str)

    try:
        parsed_dict = json.loads(cleaned_json_str)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Malformed JSON returned by AI: {str(exc)}")

    # Sanitize and validate via Pydantic
    raw_measurements = parsed_dict.get("measurements", [])
    valid_measurements: List[ExtractedMeasurement] = []
    warnings: List[str] = []

    for item in raw_measurements:
        if not isinstance(item, dict):
            continue
        test_name = str(item.get("test_name", "")).strip()
        if not test_name:
            continue

        raw_val_num = item.get("value_numeric")
        raw_val_text = item.get("value_text")

        val_numeric: Optional[float] = None
        val_text: Optional[str] = None

        if raw_val_num is not None:
            try:
                val_numeric = float(raw_val_num)
            except (ValueError, TypeError):
                val_text = str(raw_val_num).strip()

        if raw_val_text is not None and val_numeric is None:
            text_str = str(raw_val_text).strip()
            # If text parses cleanly as float, assign to numeric
            try:
                val_numeric = float(text_str)
            except ValueError:
                val_text = text_str if text_str else None

        ref_min: Optional[float] = None
        if item.get("reference_min") is not None:
            try:
                ref_min = float(item["reference_min"])
            except (ValueError, TypeError):
                ref_min = None

        ref_max: Optional[float] = None
        if item.get("reference_max") is not None:
            try:
                ref_max = float(item["reference_max"])
            except (ValueError, TypeError):
                ref_max = None

        ref_text: Optional[str] = None
        if item.get("reference_text"):
            ref_text = str(item["reference_text"]).strip()

        unit: Optional[str] = None
        if item.get("unit"):
            unit = str(item["unit"]).strip()

        valid_measurements.append(
            ExtractedMeasurement(
                test_name=test_name,
                value_numeric=val_numeric,
                value_text=val_text,
                unit=unit,
                reference_min=ref_min,
                reference_max=ref_max,
                reference_text=ref_text,
            )
        )

    # Normalize and validate report_date
    raw_date = parsed_dict.get("report_date")
    report_date: Optional[str] = normalize_extracted_date(raw_date, report_text)
    if raw_date and not report_date and str(raw_date).strip().lower() not in ("null", "none"):
        warnings.append(f"Report date '{raw_date}' requires user confirmation.")

    # Sanitize and validate lab_name (preserving authentic display casing)
    raw_lab = parsed_dict.get("lab_name")
    lab_name: Optional[str] = None
    if raw_lab and isinstance(raw_lab, str):
        cleaned_lab = raw_lab.strip()
        if cleaned_lab and cleaned_lab.lower() not in ("null", "none"):
            lab_name = cleaned_lab

    return ExtractedReportData(
        report_date=report_date,
        lab_name=lab_name,
        measurements=valid_measurements,
        warnings=warnings,
    )
