import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeTestName } from '../lib/normalization'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

export default function AddReportModal({ isOpen, onClose, onReportCreated, userId }) {
  // Modes: 'select' | 'manual' | 'upload' | 'verifying' | 'verify'
  const [mode, setMode] = useState('select')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [labName, setLabName] = useState('')
  const [rows, setRows] = useState([
    { id: 1, testName: '', value: '', unit: '', refMin: '', refMax: '', refText: '' },
  ])
  const [sourceType, setSourceType] = useState('manual')

  // PDF Upload & Extraction state
  const [selectedFile, setSelectedFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractStep, setExtractStep] = useState(0) // 0: Reading PDF, 1: Extracting measurements, 2: Structuring results, 3: Ready
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [extractionNotice, setExtractionNotice] = useState('')

  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), testName: '', value: '', unit: '', refMin: '', refMax: '', refText: '' },
    ])
  }

  const handleRemoveRow = (id) => {
    if (rows.length === 1) {
      setRows([{ id: Date.now(), testName: '', value: '', unit: '', refMin: '', refMax: '', refText: '' }])
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleRowChange = (id, field, val) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    )
  }

  const handleClose = () => {
    setMode('select')
    setSelectedFile(null)
    setExtracting(false)
    setExtractStep(0)
    setErrorMessage('')
    setExtractionNotice('')
    setSourceType('manual')
    setRows([{ id: 1, testName: '', value: '', unit: '', refMin: '', refMax: '', refText: '' }])
    onClose()
  }

  const handleFileSelect = (e) => {
    setErrorMessage('')
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF files are supported. Please select a .pdf file.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 10 MB limit.')
      return
    }

    setSelectedFile(file)
  }

  // Perform AI Extraction via FastAPI POST /extract-report
  const handleStartExtraction = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a PDF file first.')
      return
    }

    setErrorMessage('')
    setExtracting(true)
    setExtractStep(0) // 1. Reading PDF

    // Subtle stepper timing simulation while request is in flight
    const timer1 = setTimeout(() => setExtractStep(1), 700)  // 2. Extracting measurements
    const timer2 = setTimeout(() => setExtractStep(2), 1500) // 3. Structuring results

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`${BACKEND_URL}/extract-report`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      clearTimeout(timer1)
      clearTimeout(timer2)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Server error (${response.status})`)
      }

      const extracted = await response.json()

      setExtractStep(3) // 4. Ready to verify

      // Populate verification screen
      setReportDate(extracted.report_date || new Date().toISOString().split('T')[0])
      setLabName(extracted.lab_name || '')
      setSourceType('pdf')

      const extractedRows = (extracted.measurements || []).map((m, idx) => ({
        id: Date.now() + idx,
        testName: m.test_name || '',
        value: m.value_numeric !== null && m.value_numeric !== undefined
          ? String(m.value_numeric)
          : (m.value_text || ''),
        unit: m.unit || '',
        refMin: m.reference_min !== null && m.reference_min !== undefined ? String(m.reference_min) : '',
        refMax: m.reference_max !== null && m.reference_max !== undefined ? String(m.reference_max) : '',
        refText: m.reference_text || '',
      }))

      if (extractedRows.length === 0) {
        setExtractionNotice('Zero measurements could be extracted automatically. You can add them manually below.')
        setRows([{ id: 1, testName: '', value: '', unit: '', refMin: '', refMax: '', refText: '' }])
      } else {
        setExtractionNotice('Extraction completed. Please verify that all report measurements are present and accurate.')
        setRows(extractedRows)
      }

      setMode('verify')
    } catch (err) {
      setErrorMessage(err.message || 'Failed to extract data from the PDF.')
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setExtracting(false)
    }
  }

  // Save report and measurements (reused for both Manual and Verified AI Extraction)
  const handleSaveReport = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!reportDate) {
      setErrorMessage('Please provide a valid Report Date.')
      return
    }

    const validRows = rows.filter(
      (r) => r.testName.trim() !== '' && r.value.trim() !== ''
    )

    if (validRows.length === 0) {
      setErrorMessage('Please provide at least one test measurement with a Test Name and Value.')
      return
    }

    setIsSubmitting(true)
    let createdReportId = null

    try {
      // 1. Insert Report
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .insert({
          user_id: userId,
          report_date: reportDate,
          lab_name: labName.trim() || null,
          source_type: sourceType,
        })
        .select()
        .single()

      if (reportError) throw reportError
      createdReportId = reportData.id

      // 2. Prepare & normalize measurements
      const measurementsPayload = validRows.map((r) => {
        const rawName = r.testName.trim()
        const normalizedName = normalizeTestName(rawName)
        const rawVal = r.value.trim()

        const isNum = !isNaN(Number(rawVal)) && rawVal !== ''
        const valueNumeric = isNum ? Number(rawVal) : null
        const valueText = isNum ? null : rawVal

        const minNum = r.refMin && r.refMin.trim() !== '' && !isNaN(Number(r.refMin)) ? Number(r.refMin) : null
        const maxNum = r.refMax && r.refMax.trim() !== '' && !isNaN(Number(r.refMax)) ? Number(r.refMax) : null
        const refTxt = r.refText && r.refText.trim() !== '' ? r.refText.trim() : null

        return {
          report_id: createdReportId,
          test_name_raw: rawName,
          test_name_normalized: normalizedName,
          value_numeric: valueNumeric,
          value_text: valueText,
          unit: r.unit?.trim() || null,
          reference_min: minNum,
          reference_max: maxNum,
          reference_text: refTxt,
        }
      })

      // 3. Insert Measurements
      const { error: measError } = await supabase
        .from('measurements')
        .insert(measurementsPayload)

      if (measError) {
        await supabase.from('reports').delete().eq('id', createdReportId)
        throw measError
      }

      handleClose()
      onReportCreated(createdReportId)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save report to database.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepLabels = ['Reading PDF', 'Extracting measurements', 'Structuring results', 'Ready to verify']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs antialiased">
      <div className="w-full max-w-2xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              {mode === 'select' && 'Add Lab Report'}
              {mode === 'upload' && 'Upload PDF Report'}
              {mode === 'verify' && 'Verify Extracted Report'}
              {mode === 'manual' && 'Manual Report Entry'}
            </h3>
            <p className="text-xs text-stone-500">
              {mode === 'select' && 'Choose how you would like to input your report'}
              {mode === 'upload' && 'Select a text-based PDF report for automatic extraction'}
              {mode === 'verify' && 'Review and edit extracted values before saving to your workspace'}
              {mode === 'manual' && 'Enter report details and measured lab values manually'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors text-xl font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-start space-x-2">
              <span className="text-rose-500 font-bold">•</span>
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          {/* 1. SELECT MODE: Upload vs Manual */}
          {mode === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Choice A: Upload PDF */}
              <div
                onClick={() => {
                  setErrorMessage('')
                  setMode('upload')
                }}
                className="border-2 border-[#5B3FE0]/40 hover:border-[#5B3FE0] bg-white rounded-xl p-5 flex flex-col justify-between space-y-4 cursor-pointer transition-all hover:shadow-md hover:shadow-[#5B3FE0]/5 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">📄</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#5B3FE0]/10 text-[#5B3FE0] rounded-md">
                      AI Extraction
                    </span>
                  </div>
                  <h4 className="font-bold text-stone-900 text-sm group-hover:text-[#5B3FE0] transition-colors">
                    Upload Report (PDF)
                  </h4>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Upload a text-based lab PDF to extract dates, lab names, and test values with verification before saving.
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full py-2 px-3 bg-[#5B3FE0] text-white text-xs font-semibold rounded-lg shadow-xs group-hover:bg-[#4d34c7] transition-all cursor-pointer"
                >
                  Upload PDF →
                </button>
              </div>

              {/* Choice B: Add Values Manually */}
              <div
                onClick={() => {
                  setErrorMessage('')
                  setSourceType('manual')
                  setMode('manual')
                }}
                className="border border-stone-200 hover:border-stone-400 bg-stone-50/50 hover:bg-white rounded-xl p-5 flex flex-col justify-between space-y-4 cursor-pointer transition-all hover:shadow-sm group"
              >
                <div className="space-y-2">
                  <div className="text-2xl">✏️</div>
                  <h4 className="font-bold text-stone-900 text-sm group-hover:text-stone-900 transition-colors">
                    Add Values Manually
                  </h4>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Enter lab test names, numerical or textual values, units, and reference ranges directly.
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full py-2 px-3 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  Manual Entry →
                </button>
              </div>
            </div>
          )}

          {/* 2. UPLOAD MODE: Choose PDF & Extract Stepper */}
          {mode === 'upload' && (
            <div className="space-y-6">
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  selectedFile
                    ? 'border-[#5B3FE0] bg-violet-50/30'
                    : 'border-stone-300 hover:border-[#5B3FE0] bg-stone-50/50 hover:bg-stone-50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />
                <div className="space-y-2">
                  <div className="text-3xl">📄</div>
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-bold text-stone-900 font-mono">{selectedFile.name}</p>
                      <p className="text-xs text-stone-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB — Ready for extraction
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-stone-800">
                        Click to select a laboratory report PDF
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        Text-based PDFs up to 10 MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Stepper Progress Bar (Section 11) */}
              {extracting && (
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                    <span>Extraction Progress</span>
                    <span className="text-[#5B3FE0]">{stepLabels[extractStep]}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {stepLabels.map((label, idx) => (
                      <div key={idx} className="space-y-1">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx <= extractStep ? 'bg-[#5B3FE0]' : 'bg-stone-200'
                          }`}
                        />
                        <span className="text-[10px] text-stone-400 font-medium block truncate">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  onClick={handleStartExtraction}
                  disabled={!selectedFile || extracting}
                  className="w-full py-3 px-4 bg-[#5B3FE0] hover:bg-[#4d34c7] text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {extracting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Extracting with LabΔ AI...</span>
                    </>
                  ) : (
                    <span>Extract with LabΔ AI →</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 3. VERIFICATION (AI) & MANUAL ENTRY FORM */}
          {(mode === 'verify' || mode === 'manual') && (
            <form id="report-entry-form" onSubmit={handleSaveReport} className="space-y-6">
              {/* Note on Verification Screen */}
              {mode === 'verify' && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <span>⚠️</span>
                    <span>Review Before Saving</span>
                  </div>
                  <p className="text-amber-800/90 text-[11px] leading-relaxed">
                    AI extraction can make mistakes. Review, adjust, or add test measurements below before confirming.
                  </p>
                </div>
              )}

              {extractionNotice && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-800 font-medium">
                  {extractionNotice}
                </div>
              )}

              {/* Report Date & Lab Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-stone-50/70 p-4 rounded-xl border border-stone-200/80">
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                    Report Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0]"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                    Laboratory Name (optional)
                  </label>
                  <input
                    type="text"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    placeholder="e.g., Quest Diagnostics, City Labs"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0]"
                  />
                </div>
              </div>

              {/* Measurements Editable Rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Extracted Measurements ({rows.length})
                  </h4>
                  <span className="text-[11px] text-stone-400">Values can be numeric or categorical</span>
                </div>

                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="p-3 bg-stone-50/50 border border-stone-200 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs text-stone-400 font-medium">
                        <span>Measurement #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="text-stone-400 hover:text-rose-500 text-xs font-medium cursor-pointer"
                          title="Remove measurement"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        {/* Test Name */}
                        <div className="md:col-span-4">
                          <input
                            type="text"
                            placeholder="Test Name (e.g., HGB, FBS)"
                            value={row.testName}
                            onChange={(e) => handleRowChange(row.id, 'testName', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#5B3FE0]"
                          />
                        </div>

                        {/* Value */}
                        <div className="md:col-span-3">
                          <input
                            type="text"
                            placeholder="Value (13.8, Normal)"
                            value={row.value}
                            onChange={(e) => handleRowChange(row.id, 'value', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#5B3FE0]"
                          />
                        </div>

                        {/* Unit */}
                        <div className="md:col-span-2">
                          <input
                            type="text"
                            placeholder="Unit (g/dL)"
                            value={row.unit}
                            onChange={(e) => handleRowChange(row.id, 'unit', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#5B3FE0]"
                          />
                        </div>

                        {/* Ref Min */}
                        <div className="md:col-span-1.5">
                          <input
                            type="number"
                            step="any"
                            placeholder="Min"
                            value={row.refMin}
                            onChange={(e) => handleRowChange(row.id, 'refMin', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#5B3FE0]"
                          />
                        </div>

                        {/* Ref Max */}
                        <div className="md:col-span-1.5">
                          <input
                            type="number"
                            step="any"
                            placeholder="Max"
                            value={row.refMax}
                            onChange={(e) => handleRowChange(row.id, 'refMax', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#5B3FE0]"
                          />
                        </div>
                      </div>

                      {/* Reference Range Text for threshold ranges like <200 or qualitative notes */}
                      <div className="flex items-center space-x-2 pt-1">
                        <label className="text-[11px] text-stone-500 font-medium shrink-0">
                          Range / Ref Text:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. <200, >40, Negative (optional)"
                          value={row.refText || ''}
                          onChange={(e) => handleRowChange(row.id, 'refText', e.target.value)}
                          className="w-full px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#5B3FE0]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-full py-2 px-3 border border-dashed border-stone-300 hover:border-[#5B3FE0] rounded-xl text-xs font-semibold text-stone-600 hover:text-[#5B3FE0] bg-white hover:bg-[#5B3FE0]/5 transition-all cursor-pointer"
                >
                  + Add Missing Test
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between bg-stone-50/50">
          {mode === 'select' && (
            <button
              type="button"
              onClick={handleClose}
              className="ml-auto px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg cursor-pointer"
            >
              Close
            </button>
          )}

          {mode === 'upload' && (
            <>
              <button
                type="button"
                onClick={() => setMode('select')}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}

          {(mode === 'verify' || mode === 'manual') && (
            <>
              <button
                type="button"
                onClick={() => setMode(mode === 'verify' ? 'upload' : 'select')}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                ← Back
              </button>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="report-entry-form"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#5B3FE0] hover:bg-[#4d34c7] rounded-lg shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{mode === 'verify' ? 'Confirm & Save Report' : 'Save Report'}</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
