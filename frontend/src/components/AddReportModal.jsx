import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { handleSpotlightMouseMove } from '../lib/spotlight'
import { normalizeTestName } from '../lib/normalization'
import { checkForDuplicateReport } from '../lib/duplicateDetection'
import { useReportsData } from '../context/ReportsContext'

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')).replace(/\/$/, '')

export default function AddReportModal({ isOpen, onClose, onReportCreated, userId }) {
  const { refreshData } = useReportsData()
  // Modes: 'select' | 'manual' | 'upload' | 'verify'
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
  const [isSaved, setIsSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [extractionNotice, setExtractionNotice] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(null)

  const fileInputRef = useRef(null)
  const modalBodyRef = useRef(null)
  const [focusNewRowId, setFocusNewRowId] = useState(null)

  // Auto-scroll modal body to top whenever duplicateWarning or errorMessage appears
  useEffect(() => {
    if ((duplicateWarning || errorMessage) && modalBodyRef.current) {
      modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [duplicateWarning, errorMessage])

  if (!isOpen) return null

  const handleAddRow = () => {
    if (duplicateWarning) setDuplicateWarning(null)
    const newId = Date.now() + Math.random()
    setFocusNewRowId(newId)
    setRows((prev) => [
      ...prev,
      { id: newId, testName: '', value: '', unit: '', refMin: '', refMax: '', refText: '' },
    ])
  }

  const handleRemoveRow = (id) => {
    if (duplicateWarning) setDuplicateWarning(null)
    if (rows.length === 1) {
      setRows([{ id: Date.now(), testName: '', value: '', unit: '', refMin: '', refMax: '', refText: '' }])
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleRowChange = (id, field, val) => {
    if (duplicateWarning) setDuplicateWarning(null)
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
    setDuplicateWarning(null)
    setIsSaved(false)
    setIsSubmitting(false)
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

    const timer1 = setTimeout(() => setExtractStep(1), 600)  // 2. Extracting measurements
    const timer2 = setTimeout(() => setExtractStep(2), 1400) // 3. Structuring results

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
        throw new Error(errorData.detail || `Extraction server error (${response.status})`)
      }

      const extracted = await response.json()
      setExtractStep(3) // 4. Ready

      // Populate verification screen
      setSourceType('pdf')
      setReportDate(extracted.report_date || '')
      setLabName(extracted.lab_name || '')

      if (extracted.warnings && extracted.warnings.length > 0) {
        setExtractionNotice(extracted.warnings.join(' '))
      } else if (!extracted.report_date) {
        setExtractionNotice('Report date was not explicitly found in this document. Please enter the report date below before saving.')
      } else {
        setExtractionNotice('')
      }

      if (extracted.measurements && extracted.measurements.length > 0) {
        const mappedRows = extracted.measurements.map((m, idx) => ({
          id: Date.now() + idx,
          testName: m.test_name_raw || m.test_name || '',
          value: m.value_numeric !== null && m.value_numeric !== undefined ? String(m.value_numeric) : (m.value_text || ''),
          unit: m.unit || '',
          refMin: m.reference_min !== null && m.reference_min !== undefined ? String(m.reference_min) : '',
          refMax: m.reference_max !== null && m.reference_max !== undefined ? String(m.reference_max) : '',
          refText: m.reference_text || '',
        }))
        setRows(mappedRows)
      } else {
        setRows([{ id: 1, testName: '', value: '', unit: '', refMin: '', refMax: '', refText: '' }])
        setExtractionNotice('No distinct measurements could be identified in this document. Please enter values below.')
      }

      setMode('verify')
    } catch (err) {
      setErrorMessage(err.message || 'PDF extraction failed. You can enter values manually.')
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setExtracting(false)
    }
  }

  // Save Report & Measurements to Supabase
  const handleSaveReport = async (e, forceDuplicateSave = false) => {
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    setErrorMessage('')

    if (!reportDate) {
      setErrorMessage('Report date is required.')
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }

    // Filter valid rows
    const validRows = rows.filter((r) => r.testName.trim() !== '')
    if (validRows.length === 0) {
      setErrorMessage('Please add at least one test measurement with a name.')
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }

    for (const row of validRows) {
      if (!row.value || row.value.trim() === '') {
        setErrorMessage(`Please provide a value for test "${row.testName}".`)
        if (modalBodyRef.current) {
          modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        }
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Check for exact duplicate report unless explicitly bypassed via "Save Duplicate Anyway"
      if (!forceDuplicateSave) {
        const { isDuplicate } = await checkForDuplicateReport({
          supabase,
          userId,
          reportDate,
          labName,
          validRows,
        })

        if (isDuplicate) {
          const labDisplay = labName && labName.trim() ? `from ${labName.trim()} ` : ''
          setDuplicateWarning({
            message: `An identical report ${labDisplay}on ${reportDate} with the same measurements already exists in your account.`,
          })
          setIsSubmitting(false)
          // Smoothly scroll modal body to top immediately so user sees the warning banner
          if (modalBodyRef.current) {
            modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' })
          }
          return
        }
      }

      // 1. Insert Report
      const { data: repData, error: repError } = await supabase
        .from('reports')
        .insert({
          user_id: userId,
          report_date: reportDate,
          lab_name: labName.trim() || null,
          source_type: sourceType,
        })
        .select('id')
        .single()

      if (repError) throw repError

      const reportId = repData.id

      // 2. Insert Measurements with deterministic normalization
      const measurementRecords = validRows.map((row) => {
        const rawName = row.testName.trim()
        const normalized = normalizeTestName(rawName)

        const rawVal = row.value.trim()
        const numVal = parseFloat(rawVal)
        const isNumeric = !isNaN(numVal) && isFinite(rawVal)

        const minVal = row.refMin !== '' && !isNaN(parseFloat(row.refMin)) ? parseFloat(row.refMin) : null
        const maxVal = row.refMax !== '' && !isNaN(parseFloat(row.refMax)) ? parseFloat(row.refMax) : null

        return {
          report_id: reportId,
          test_name_raw: rawName,
          test_name_normalized: normalized,
          value_numeric: isNumeric ? numVal : null,
          value_text: isNumeric ? null : rawVal,
          unit: row.unit.trim() || null,
          reference_min: minVal,
          reference_max: maxVal,
          reference_text: row.refText.trim() || null,
        }
      })

      const { error: measError } = await supabase
        .from('measurements')
        .insert(measurementRecords)

      if (measError) throw measError

      // Visual save confirmation feedback on button
      setIsSaved(true)
      setIsSubmitting(false)

      // Short delay for visual confirmation before closing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Close modal and notify
      setDuplicateWarning(null)
      handleClose()
      if (refreshData) {
        refreshData()
      }
      if (onReportCreated) {
        onReportCreated(reportId)
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save report.')
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepLabels = [
    '1. Reading PDF',
    '2. Extracting measurements',
    '3. Structuring results',
    '4. Ready to verify',
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in">
      <div className="bg-white dark:bg-[#111726] rounded-3xl shadow-2xl border border-stone-200/90 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-stone-50/40 dark:bg-slate-900/40">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-stone-900 dark:text-slate-100">
              {mode === 'select' && 'Add Lab Report'}
              {mode === 'upload' && 'Upload Lab Report (PDF)'}
              {mode === 'verify' && 'Verify Extracted Report'}
              {mode === 'manual' && 'Manual Report Entry'}
            </h3>
            <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 mt-0.5">
              {mode === 'select' && 'Choose how you want to add your laboratory report'}
              {mode === 'upload' && 'Extract structured values from a text-based laboratory PDF'}
              {mode === 'verify' && 'Review extracted report details and measurements before confirming'}
              {mode === 'manual' && 'Enter test names, observed values, and reference ranges'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-7.5 h-7.5 rounded-full bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div ref={modalBodyRef} className="p-3.5 sm:p-4.5 overflow-y-auto flex-1 space-y-3 sm:space-y-3.5">
          {errorMessage && (
            <div className="p-3 sm:p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-xl text-xs sm:text-sm text-rose-700 dark:text-rose-300 font-medium flex items-start space-x-2 animate-fade-in">
              <span className="text-rose-500 font-bold shrink-0">•</span>
              <span className="flex-1 leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Amber Duplicate Report Warning */}
          {duplicateWarning && (
            <div className="p-3 sm:p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-2.5 animate-fade-in shadow-2xs">
              <div className="flex items-start space-x-2.5">
                <span className="text-amber-600 dark:text-amber-400 font-bold text-sm shrink-0 mt-0.5">⚠️</span>
                <div className="flex-1 space-y-0.5">
                  <h4 className="font-bold text-stone-900 dark:text-slate-100 text-xs sm:text-sm">
                    Duplicate report detected
                  </h4>
                  <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    {duplicateWarning.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300/80 dark:border-amber-700 text-stone-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-amber-50/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Review / Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveReport(null, true)}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  Save Duplicate Anyway
                </button>
              </div>
            </div>
          )}

          {/* 1. INITIAL MODE SELECTION (PDF vs Manual) */}
          {mode === 'select' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 py-1">
              {/* PDF Extraction Card */}
              <div
                onClick={() => setMode('upload')}
                onMouseMove={handleSpotlightMouseMove}
                className="spotlight-surface border-2 border-[#5B3FE0]/30 hover:border-[#5B3FE0] bg-violet-50/20 dark:bg-violet-950/20 hover:bg-violet-50/50 dark:hover:bg-violet-950/40 rounded-2xl p-3.5 sm:p-4.5 text-center space-y-2.5 transition-all cursor-pointer card-interactive group shadow-2xs relative"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-xl sm:text-2xl flex items-center justify-center mx-auto transition-transform duration-200 group-hover:scale-110 group-hover:rotate-2">
                  📄
                </div>
                <div className="space-y-0.5 relative z-10">
                  <div className="flex items-center justify-center space-x-1.5">
                    <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-slate-100">Upload PDF</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#5B3FE0] text-white px-1.5 py-0.2 rounded-full">
                      AI Powered
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
                    Automatically parse test names, numeric results, and reference ranges from laboratory documents.
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full py-2 px-3.5 btn-primary text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 relative z-10"
                >
                  <span>Select PDF Report</span>
                  <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>

              {/* Manual Entry Card */}
              <div
                onClick={() => {
                  setSourceType('manual')
                  setMode('manual')
                }}
                onMouseMove={handleSpotlightMouseMove}
                className="spotlight-surface border-2 border-stone-200 dark:border-slate-800 hover:border-[#5B3FE0]/40 bg-stone-50/40 dark:bg-slate-900/40 hover:bg-stone-50/80 dark:hover:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4.5 text-center space-y-2.5 transition-all cursor-pointer card-interactive group shadow-2xs relative"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 text-xl sm:text-2xl flex items-center justify-center mx-auto transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-2">
                  ✍️
                </div>
                <div className="space-y-0.5 relative z-10">
                  <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-slate-100">Add Values Manually</h4>
                  <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
                    Type in individual laboratory biomarkers, categorical results, or custom panel markers directly.
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full py-2 px-3.5 btn-secondary text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 relative z-10"
                >
                  <span>Enter Manually</span>
                  <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. PDF UPLOAD SCREEN */}
          {mode === 'upload' && (
            <div className="space-y-3.5 py-1">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-[#5B3FE0] bg-violet-50/30 dark:bg-violet-950/30'
                    : 'border-stone-300 dark:border-slate-700 hover:border-[#5B3FE0] bg-stone-50/50 dark:bg-slate-900/50 hover:bg-stone-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />
                <div className="space-y-1.5">
                  <div className="text-3xl sm:text-4xl">📄</div>
                  {selectedFile ? (
                    <div className="space-y-0.5">
                      <p className="text-xs sm:text-sm font-bold text-stone-900 dark:text-slate-100 font-mono break-all">{selectedFile.name}</p>
                      <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB — Tap button below to begin extraction
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-stone-800 dark:text-slate-200">
                        Tap or click to select a laboratory report PDF
                      </p>
                      <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                        Text-based PDFs up to 10 MB (works on phones and desktop)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Animated Stepper Progress Bar */}
              {extracting && (
                <div className="bg-stone-50 dark:bg-slate-900/90 p-3.5 sm:p-4 rounded-xl border border-stone-200 dark:border-slate-800 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-slate-300">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-[#5B3FE0] animate-ping" />
                      <span>Extraction Progress</span>
                    </div>
                    <span className="text-[#5B3FE0] dark:text-[#8266FA] font-mono font-bold">{stepLabels[extractStep]}</span>
                  </div>

                  {/* Connecting Stepper Track */}
                  <div className="relative pt-1 pb-0.5">
                    <div className="absolute top-4 left-4 right-4 h-1 bg-stone-200 dark:bg-slate-800 rounded-full z-0"></div>
                    <div
                      className="absolute top-4 left-4 h-1 bg-[#5B3FE0] rounded-full z-0 stepper-bar-fill"
                      style={{ width: `calc(${(extractStep / (stepLabels.length - 1)) * 100}% - 16px)` }}
                    ></div>
                    <div className="relative z-10 flex justify-between">
                      {stepLabels.map((label, idx) => {
                        const isDone = idx < extractStep
                        const isCurrent = idx === extractStep
                        return (
                          <div key={idx} className="flex flex-col items-center space-y-1 w-12 sm:w-14">
                            <div
                              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                                isDone
                                    ? 'bg-[#5B3FE0] text-white shadow-xs'
                                    : isCurrent
                                  ? 'bg-white dark:bg-[#1E293B] border-2 border-[#5B3FE0] text-[#5B3FE0] dark:text-[#8266FA] shadow-sm ring-2 sm:ring-3 ring-[#5B3FE0]/20 animate-pulse-ring'
                                  : 'bg-stone-100 dark:bg-slate-800 border border-stone-300 dark:border-slate-700 text-stone-400 dark:text-slate-500'
                              }`}
                            >
                              {isDone ? '✓' : idx + 1}
                            </div>
                            <span
                              className={`text-[10px] text-center truncate w-full ${
                                isCurrent ? 'text-[#5B3FE0] dark:text-[#8266FA] font-bold' : 'text-stone-400 dark:text-slate-500'
                              }`}
                            >
                              {label.split('.')[1]?.trim() || label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  onClick={handleStartExtraction}
                  disabled={!selectedFile || extracting}
                  className="w-full py-2 sm:py-2.5 px-4 btn-primary text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2"
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
            <form id="report-entry-form" onSubmit={handleSaveReport} className="space-y-3.5 sm:space-y-4">
              {/* Note on Verification Screen */}
              {mode === 'verify' && (
                <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-3 sm:p-3.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200 space-y-0.5">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <span>⚠️</span>
                    <span>Review Before Saving</span>
                  </div>
                  <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    AI extraction may occasionally make mistakes. Review, adjust, or add test measurements below before confirming.
                  </p>
                </div>
              )}

              {extractionNotice && (
                <div className="p-3 bg-violet-50 border border-violet-200 dark:bg-[#5B3FE0]/15 dark:border-[#5B3FE0]/30 dark:text-violet-300 rounded-xl text-xs font-medium">
                  {extractionNotice}
                </div>
              )}

              {/* REPORT DETAILS SECTION */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-slate-400">
                    Report Details
                  </h4>
                  {!reportDate && mode === 'verify' && (
                    <span className="text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                      * Report date required before saving
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 bg-stone-50/70 dark:bg-[#131B2E] p-3 rounded-xl border border-stone-200/80 dark:border-slate-800">
                  <div className="space-y-1 text-left">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                      Laboratory Name {mode === 'verify' ? '' : '(optional)'}
                    </label>
                    <input
                      type="text"
                      value={labName}
                      onChange={(e) => {
                        if (duplicateWarning) setDuplicateWarning(null)
                        setLabName(e.target.value)
                      }}
                      placeholder="e.g., Quest Diagnostics, City Labs"
                      className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-[#0B0F19] border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0]"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                      Report Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => {
                        if (duplicateWarning) setDuplicateWarning(null)
                        setReportDate(e.target.value)
                      }}
                      required
                      className={`w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-[#0B0F19] border rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] ${
                        !reportDate && mode === 'verify' ? 'border-rose-300 dark:border-rose-700/80' : 'border-stone-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Context-Aware Heading (Section I & User Instruction 8) */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-slate-200">
                    {mode === 'verify'
                      ? `Extracted Measurements (${rows.length})`
                      : `Report Measurements (${rows.length})`}
                  </h4>
                  <span className="text-[11px] text-stone-400 dark:text-slate-500">Values can be numeric or categorical</span>
                </div>

                {/* Measurements Editable Rows with Fixed 12-Column Responsive Grid */}
                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      className={`p-2.5 sm:p-3 bg-stone-50/50 dark:bg-[#131B2E]/60 border border-stone-200/90 dark:border-slate-800 rounded-xl space-y-2 ${
                        focusNewRowId === row.id ? 'animate-slide-down' : 'animate-fade-in'
                      } transition-all duration-150 hover:border-stone-300 dark:hover:border-slate-700 hover:shadow-xs`}
                    >
                      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-slate-400 font-medium">
                        <span className="font-semibold text-xs">Measurement #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="text-stone-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 text-xs font-medium cursor-pointer p-0.5 transition-colors"
                          title="Remove measurement"
                        >
                          Remove ✕
                        </button>
                      </div>

                      {/* 12-column grid replacing broken col-span-1.5 with full readability */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2">
                        {/* Test Name: 4 cols */}
                        <div className="sm:col-span-2 md:col-span-4">
                          <label className="block text-[10px] uppercase font-bold text-stone-500 dark:text-slate-400 mb-0.5">
                            Test Name
                          </label>
                          <input
                            type="text"
                            ref={(el) => {
                              if (el && focusNewRowId === row.id) {
                                el.focus()
                                setFocusNewRowId(null)
                              }
                            }}
                            placeholder="e.g. Hemoglobin, WBC"
                            value={row.testName}
                            onChange={(e) => handleRowChange(row.id, 'testName', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0B0F19] border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] transition-all"
                          />
                        </div>

                        {/* Value: 2 cols */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-stone-500 dark:text-slate-400 mb-0.5">
                            Value
                          </label>
                          <input
                            type="text"
                            placeholder="13.8 / Borderline"
                            value={row.value}
                            onChange={(e) => handleRowChange(row.id, 'value', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0B0F19] border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] transition-all"
                          />
                        </div>

                        {/* Unit: 2 cols */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-stone-500 dark:text-slate-400 mb-0.5">
                            Unit
                          </label>
                          <input
                            type="text"
                            placeholder="g/dL, /µL"
                            value={row.unit}
                            onChange={(e) => handleRowChange(row.id, 'unit', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0B0F19] border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] transition-all"
                          />
                        </div>

                        {/* Ref Min: 2 cols */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-stone-500 dark:text-slate-400 mb-0.5">
                            Ref Min
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="Min (13.0)"
                            value={row.refMin}
                            onChange={(e) => handleRowChange(row.id, 'refMin', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0B0F19] border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] transition-all"
                          />
                        </div>

                        {/* Ref Max: 2 cols */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-stone-500 dark:text-slate-400 mb-0.5">
                            Ref Max
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="Max (17.0)"
                            value={row.refMax}
                            onChange={(e) => handleRowChange(row.id, 'refMax', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#0B0F19] border border-stone-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] transition-all"
                          />
                        </div>
                      </div>

                      {/* Reference Range Text for threshold ranges like <200 or qualitative notes */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 pt-0.5">
                        <label className="text-[11px] text-stone-600 dark:text-slate-400 font-medium shrink-0">
                          Range / Text Note (optional):
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. <200, >40, Negative"
                          value={row.refText || ''}
                          onChange={(e) => handleRowChange(row.id, 'refText', e.target.value)}
                          className="w-full px-2.5 py-1 bg-white dark:bg-[#0B0F19] border border-stone-200 dark:border-slate-700 rounded-xl text-xs text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0] transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Context-Aware Add Measurement Button (Section I & User Instruction 8) */}
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-full py-2 sm:py-2.5 px-4 border border-dashed border-stone-300 dark:border-slate-700 hover:border-[#5B3FE0] dark:hover:border-[#5B3FE0] rounded-xl text-xs font-semibold text-stone-600 dark:text-slate-300 hover:text-[#5B3FE0] dark:hover:text-[#5B3FE0] bg-white dark:bg-[#131B2E]/40 hover:bg-[#5B3FE0]/5 dark:hover:bg-[#5B3FE0]/10 transition-all duration-150 cursor-pointer btn-press flex items-center justify-center space-x-1.5"
                >
                  <span>+ Add Another Measurement</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between bg-stone-50/50 dark:bg-[#0E1526] shrink-0">
          {mode === 'select' && (
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary ml-auto px-4 py-1.5 sm:py-2 text-xs font-semibold text-stone-700 dark:text-slate-200 bg-white dark:bg-[#131B2E] border border-stone-200 dark:border-slate-700 rounded-xl cursor-pointer"
            >
              Close
            </button>
          )}

          {mode === 'upload' && (
            <>
              <button
                type="button"
                onClick={() => setMode('select')}
                className="btn-secondary px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-stone-700 dark:text-slate-200 bg-white dark:bg-[#131B2E] border border-stone-200 dark:border-slate-700 rounded-xl cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="btn-ghost px-3 py-1.5 sm:py-2 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer rounded-xl"
              >
                Cancel
              </button>
            </>
          )}

          {(mode === 'verify' || mode === 'manual') && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'verify') setMode('upload')
                  else setMode('select')
                }}
                className="btn-secondary px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-stone-700 dark:text-slate-200 bg-white dark:bg-[#131B2E] border border-stone-200 dark:border-slate-700 rounded-xl cursor-pointer"
              >
                ← Back
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-ghost px-3 py-1.5 sm:py-2 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="report-entry-form"
                  disabled={isSubmitting || isSaved}
                  className={`px-3.5 sm:px-4.5 py-1.5 sm:py-2 font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 ${
                    isSaved
                      ? 'bg-emerald-600 text-white'
                      : 'btn-primary text-white'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : isSaved ? (
                    <>
                      <span className="text-sm font-bold">✓</span>
                      <span>Saved!</span>
                    </>
                  ) : (
                    <span>Confirm & Save Report</span>
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
