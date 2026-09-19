import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeTestName } from '../lib/normalization'

export default function AddReportModal({ isOpen, onClose, onReportCreated, userId }) {
  const [mode, setMode] = useState('select') // 'select' | 'manual'
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [labName, setLabName] = useState('')
  const [rows, setRows] = useState([
    { id: 1, testName: '', value: '', unit: '', refMin: '', refMax: '' },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (!isOpen) return null

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), testName: '', value: '', unit: '', refMin: '', refMax: '' },
    ])
  }

  const handleRemoveRow = (id) => {
    if (rows.length === 1) {
      setRows([{ id: Date.now(), testName: '', value: '', unit: '', refMin: '', refMax: '' }])
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
    setErrorMessage('')
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!reportDate) {
      setErrorMessage('Please provide a valid Report Date.')
      return
    }

    // Filter valid rows (must have at least testName and value)
    const validRows = rows.filter(
      (r) => r.testName.trim() !== '' && r.value.trim() !== ''
    )

    if (validRows.length === 0) {
      setErrorMessage('Please add at least one test measurement with a Test Name and Value.')
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
          source_type: 'manual',
        })
        .select()
        .single()

      if (reportError) throw reportError
      createdReportId = reportData.id

      // 2. Prepare and normalize Measurements
      const measurementsPayload = validRows.map((r) => {
        const rawName = r.testName.trim()
        const normalizedName = normalizeTestName(rawName)
        const rawVal = r.value.trim()

        // Check if value is numeric or text
        const isNum = !isNaN(Number(rawVal)) && rawVal !== ''
        const valueNumeric = isNum ? Number(rawVal) : null
        const valueText = isNum ? null : rawVal

        const minNum = r.refMin.trim() !== '' && !isNaN(Number(r.refMin)) ? Number(r.refMin) : null
        const maxNum = r.refMax.trim() !== '' && !isNaN(Number(r.refMax)) ? Number(r.refMax) : null

        return {
          report_id: createdReportId,
          test_name_raw: rawName,
          test_name_normalized: normalizedName,
          value_numeric: valueNumeric,
          value_text: valueText,
          unit: r.unit.trim() || null,
          reference_min: minNum,
          reference_max: maxNum,
        }
      })

      // 3. Insert Measurements
      const { error: measError } = await supabase
        .from('measurements')
        .insert(measurementsPayload)

      if (measError) {
        // Rollback created report if measurements insert failed
        await supabase.from('reports').delete().eq('id', createdReportId)
        throw measError
      }

      // Success
      handleClose()
      onReportCreated(createdReportId)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save report. Please check database configuration.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs antialiased">
      <div className="w-full max-w-2xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              {mode === 'select' ? 'Add Lab Report' : 'Manual Report Entry'}
            </h3>
            <p className="text-xs text-stone-500">
              {mode === 'select'
                ? 'Choose how you would like to input your report'
                : 'Enter report details and measured lab values'}
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center space-x-2">
              <span className="text-rose-500 font-bold">•</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'select' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Choice A: Upload PDF (Upcoming) */}
              <div className="border border-stone-200 rounded-xl p-5 bg-stone-50/70 opacity-85 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">📄</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-violet-100 text-[#5B3FE0] rounded-full uppercase">
                      Upcoming
                    </span>
                  </div>
                  <h4 className="font-bold text-stone-900 text-sm">Upload Report</h4>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Upload a lab report PDF or scan to automatically parse and extract markers.
                  </p>
                </div>
                <div className="text-[11px] text-stone-400 font-medium bg-stone-100/80 p-2.5 rounded-lg border border-stone-200/60">
                  PDF extraction will be available in the next build.
                </div>
              </div>

              {/* Choice B: Add Values Manually */}
              <div
                onClick={() => setMode('manual')}
                className="border-2 border-[#5B3FE0]/40 hover:border-[#5B3FE0] bg-white rounded-xl p-5 flex flex-col justify-between space-y-4 cursor-pointer transition-all hover:shadow-md hover:shadow-[#5B3FE0]/5 group"
              >
                <div className="space-y-2">
                  <div className="text-2xl">✏️</div>
                  <h4 className="font-bold text-stone-900 text-sm group-hover:text-[#5B3FE0] transition-colors">
                    Add Values Manually
                  </h4>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Enter lab test names, numerical or textual values, units, and reference ranges directly.
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full py-2 px-3 bg-[#5B3FE0] text-white text-xs font-semibold rounded-lg shadow-xs group-hover:bg-[#4d34c7] transition-all"
                >
                  Start Manual Entry →
                </button>
              </div>
            </div>
          ) : (
            <form id="manual-report-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Report Meta Info */}
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
                    placeholder="e.g., Quest Diagnostics, Labcorp"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0]"
                  />
                </div>
              </div>

              {/* Dynamic Measurements */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Test Measurements ({rows.length})
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
                        <span>Marker #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="text-stone-400 hover:text-rose-500 text-xs font-medium cursor-pointer"
                          title="Remove row"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        {/* Test Name */}
                        <div className="md:col-span-4">
                          <input
                            type="text"
                            placeholder="Test Name (e.g., Hb, FBS)"
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
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-full py-2 px-3 border border-dashed border-stone-300 hover:border-[#5B3FE0] rounded-xl text-xs font-semibold text-stone-600 hover:text-[#5B3FE0] bg-white hover:bg-[#5B3FE0]/5 transition-all cursor-pointer"
                >
                  + Add Another Test
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between bg-stone-50/50">
          {mode === 'manual' ? (
            <>
              <button
                type="button"
                onClick={() => setMode('select')}
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
                  form="manual-report-form"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#5B3FE0] hover:bg-[#4d34c7] rounded-lg shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Report</span>
                  )}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="ml-auto px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg cursor-pointer"
            >
              Close
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
