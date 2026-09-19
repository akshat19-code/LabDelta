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


SYSTEM_PROMPT = """You are a strict clinical laboratory report data extraction engine.
Your ONLY role is information extraction from the provided laboratory report text.

CRITICAL RULES:
1. Extract ONLY information explicitly present in the report text.
2. If any field is absent or uncertain, return null rather than guessing.
3. NEVER diagnose, interpret, or recommend treatment.
4. NEVER invent reference ranges, units, or missing measurements.
5. NEVER correct or normalize test names; preserve the exact raw wording in the report (e.g., "HGB", "FBS", "Serum XYZ Marker").
6. For values:
   - If numeric, set value_numeric to the float/int and value_text to null.
   - If categorical/textual (e.g., "Positive", "Negative", "Borderline", "Detected"), set value_text to the exact text and value_numeric to null.
7. For reference ranges:
   - If explicit numeric bounds exist (e.g., "13 - 17"), set reference_min and reference_max to numbers.
   - If threshold text or qualitative (e.g., "< 200", "> 40", "Negative"), set reference_text and do NOT invent bounds.
8. Output MUST be valid JSON adhering strictly to the schema."""


USER_PROMPT_TEMPLATE = """Extract the lab report details and all measured tests from this report text:

--- BEGIN REPORT TEXT ---
{report_text}
--- END REPORT TEXT ---

Return a JSON object with this exact structure:
{{
  "report_date": "YYYY-MM-DD or null",
  "lab_name": "Laboratory name or null",
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

    # Validate report_date format if present
    raw_date = parsed_dict.get("report_date")
    report_date: Optional[str] = None
    if raw_date and isinstance(raw_date, str):
        date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", raw_date)
        if date_match:
            report_date = date_match.group(1)
        else:
            report_date = raw_date.strip()

    lab_name: Optional[str] = None
    if parsed_dict.get("lab_name"):
        lab_name = str(parsed_dict["lab_name"]).strip()

    return ExtractedReportData(
        report_date=report_date,
        lab_name=lab_name,
        measurements=valid_measurements,
        warnings=warnings,
    )
