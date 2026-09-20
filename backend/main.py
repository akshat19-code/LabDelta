from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from backend.auth import get_current_user
from backend.extraction import call_groq_extraction, extract_text_from_pdf

app = FastAPI(title="LabDelta Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "LabDelta"}


@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/extract-report")
async def extract_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    # 1. Validate file extension
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported. Please upload a file with a .pdf extension.",
        )

    # 2. Read file safely in memory
    try:
        contents = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(exc)}",
        )

    # 3. Check file size
    if len(contents) > MAX_PDF_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="PDF file exceeds the 10 MB size limit.",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF file is empty.",
        )

    # 4. Extract text with PyMuPDF
    try:
        extracted_text = extract_text_from_pdf(contents)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    # 5. Check if PDF contains selectable text
    if not extracted_text or len(extracted_text.strip()) < 20:
        raise HTTPException(
            status_code=422,
            detail="This PDF appears to contain little or no selectable text. Please use Manual Entry for this report.",
        )

    # 6. Call Groq for structured information extraction
    try:
        data = call_groq_extraction(extracted_text)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return {
        "report_date": data.report_date,
        "lab_name": data.lab_name,
        "measurements": [m.model_dump() for m in data.measurements],
        "warnings": data.warnings,
    }
