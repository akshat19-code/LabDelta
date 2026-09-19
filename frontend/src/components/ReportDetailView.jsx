import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ReportDetailView({ reportId, onBack }) {
  const [report, setReport] = useState(null)
  const [measurements, setMeasurements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchReportDetails() {
      setLoading(true)
      setError('')
      try {
        // 1. Fetch Report
        const { data: repData, error: repError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', reportId)
          .single()

        if (repError) throw repError

        // 2. Fetch Measurements
        const { data: measData, error: measError } = await supabase
          .from('measurements')
          .select('*')
          .eq('report_id', reportId)
          .order('created_at', { ascending: true })

        if (measError) throw measError

        setReport(repData)
        setMeasurements(measData || [])
      } catch (err) {
        setError(err.message || 'Failed to load report details.')
      } finally {
        setLoading(false)
      }
    }

    if (reportId) {
      fetchReportDetails()
    }
  }, [reportId])

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-stone-500">Loading lab report details...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="space-y-4 max-w-2xl">
        <button
          onClick={onBack}
          className="text-xs font-semibold text-stone-600 hover:text-[#5B3FE0] flex items-center space-x-1 cursor-pointer"
        >
          <span>← Back to Reports</span>
        </button>
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error || 'Report not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl antialiased">
      {/* Back Link */}
      <div>
        <button
          onClick={onBack}
          className="text-xs font-semibold text-stone-500 hover:text-[#5B3FE0] flex items-center space-x-1.5 cursor-pointer transition-colors"
        >
          <span>←</span>
          <span>Back to Report History</span>
        </button>
      </div>

      {/* Report Header Card */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B3FE0] bg-violet-50 border border-violet-100 px-2.5 py-0.5 rounded-md">
              {report.source_type}
            </span>
            <span className="text-xs text-stone-400 font-mono">
              Recorded on {new Date(report.created_at).toLocaleDateString()}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-stone-900">
            {new Date(report.report_date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h2>
          <p className="text-sm font-medium text-stone-600">
            {report.lab_name || 'Lab not specified'}
          </p>
        </div>

        <div className="text-left md:text-right bg-stone-50 md:bg-transparent p-3 md:p-0 rounded-xl">
          <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold block">
            Total Measurements
          </span>
          <span className="text-xl font-extrabold text-stone-900">
            {measurements.length} {measurements.length === 1 ? 'test' : 'tests'}
          </span>
        </div>
      </div>

      {/* Measurements Table Card */}
      <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800">
            Measured Values
          </h3>
          <span className="text-xs text-stone-400">
            Direct laboratory test observations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/70 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <th className="py-3 px-6">Test</th>
                <th className="py-3 px-6">Value</th>
                <th className="py-3 px-6">Unit</th>
                <th className="py-3 px-6">Reference Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {measurements.map((m) => {
                // Determine display value
                const displayVal =
                  m.value_numeric !== null ? m.value_numeric : m.value_text || '—'

                // Reference range string
                let refDisplay = '—'
                if (m.reference_min !== null && m.reference_max !== null) {
                  refDisplay = `${m.reference_min} – ${m.reference_max}`
                } else if (m.reference_min !== null) {
                  refDisplay = `≥ ${m.reference_min}`
                } else if (m.reference_max !== null) {
                  refDisplay = `≤ ${m.reference_max}`
                } else if (m.reference_text) {
                  refDisplay = m.reference_text
                }

                return (
                  <tr key={m.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-stone-900">
                        {m.test_name_normalized}
                      </div>
                      {m.test_name_raw.toLowerCase() !== m.test_name_normalized.toLowerCase() && (
                        <div className="text-[11px] text-stone-400 font-mono">
                          Raw: {m.test_name_raw}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-stone-900 font-mono">
                      {displayVal}
                    </td>
                    <td className="py-3.5 px-6 text-stone-500 text-xs font-mono">
                      {m.unit || '—'}
                    </td>
                    <td className="py-3.5 px-6 text-stone-600 text-xs font-mono">
                      {refDisplay}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {measurements.length === 0 && (
          <div className="py-8 text-center text-xs text-stone-400">
            No measurements recorded for this report.
          </div>
        )}
      </div>

    </div>
  )
}
