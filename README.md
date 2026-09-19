# LabΔ (LabDelta)

A hackathon project for lab delta analysis.

## Project Structure

```text
LabDelta/
├── backend/    # FastAPI backend
├── frontend/   # React + Vite + Tailwind CSS frontend
├── .gitignore
└── README.md
```

## Getting Started

### 1. Backend (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **macOS/Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend API will run at `http://127.0.0.1:8000` (Health check: `http://127.0.0.1:8000/health`).

### 2. Frontend (React + Vite)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser. The page will connect to the FastAPI `/health` endpoint.
