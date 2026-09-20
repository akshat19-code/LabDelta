import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatValue, formatDate, formatReferenceRange } from '../lib/formatting'
import { useReportsData } from '../context/ReportsContext'

export default function ReportDetailView({ reportId, onBack, onCompare }) {
  const { reports: cachedReports = [], measurements: cachedMeasurements = [] } = useReportsData()

  const cachedRep = cachedReports.find((r) => r.id === reportId)
  const cachedMeas = cachedMeasurements.filter((m) => m.report_id === reportId)

  const [report, setReport] = useState(cachedRep || null)
  const [measurements, setMeasurements] = useState(cachedMeas.length > 0 ? cachedMeas : [])
  const [loading, setLoading] = useState(!cachedRep)
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
      <div className="space-y-6 antialiased">
        <div className="flex items-center justify-between animate-pulse">
          <div className="h-4 w-36 bg-stone-200 rounded-md"></div>
          <div className="h-8 w-44 bg-stone-200 rounded-xl"></div>
        </div>
        <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-7 space-y-4 animate-pulse">
          <div className="h-5 w-24 bg-stone-200 rounded-md"></div>
          <div className="h-8 w-64 bg-stone-200 rounded-xl"></div>
          <div className="h-4 w-40 bg-stone-100 rounded-md"></div>
        </div>
        <div className="bg-white border border-stone-200/90 rounded-3xl p-6 space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-stone-50 rounded-xl"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="space-y-4 max-w-2xl animate-fade-in">
        <button
          onClick={onBack}
          className="text-xs font-semibold text-stone-600 hover:text-[#5B3FE0] flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <span>← Back to Reports</span>
        </button>
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
          {error || 'Report not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 antialiased animate-fade-in">
      {/* Back Link & Compare Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={onBack}
          className="text-sm sm:text-base font-semibold text-stone-500 dark:text-slate-400 hover:text-[#5B3FE0] dark:hover:text-[#8266FA] flex items-center space-x-1.5 cursor-pointer transition-colors"
        >
          <span>←</span>
          <span>Back to Report History</span>
        </button>
        {onCompare && (
          <button
            onClick={() => onCompare(report.id)}
            className="btn-primary inline-flex items-center space-x-2 px-5 py-2.5 sm:py-3 text-white text-sm sm:text-base font-semibold rounded-xl shadow-xs cursor-pointer"
          >
            <span>Compare with another report</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* Report Header Card */}
      <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 lg:p-8 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2.5">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                report.source_type === 'demo'
                  ? 'bg-violet-50 dark:bg-violet-950/60 text-[#5B3FE0] dark:text-[#8266FA] border border-violet-200/70 dark:border-violet-800/60'
                  : report.source_type === 'pdf'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-400'
              }`}
            >
              {report.source_type === 'pdf' ? 'PDF Report' : report.source_type === 'demo' ? 'Demo Report' : 'Manual Entry'}
            </span>
            <span className="text-xs sm:text-sm text-stone-400 dark:text-slate-500 font-mono">
              Recorded: {formatDate(report.created_at)}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-slate-100">
            {report.lab_name || 'Laboratory Report'}
          </h2>
          <p className="text-base sm:text-lg font-semibold text-stone-700 dark:text-slate-300">
            Report Date: {formatDate(report.report_date, { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="text-left md:text-right bg-stone-50 dark:bg-[#0F172A]/70 md:bg-transparent dark:md:bg-transparent p-5 md:p-0 rounded-2xl border md:border-0 border-stone-100 dark:border-slate-800">
          <span className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 uppercase tracking-wider font-semibold block">
            Total Measurements
          </span>
          <span className="text-3xl sm:text-4xl font-black text-stone-900 dark:text-slate-100 font-mono">
            {measurements.length} {measurements.length === 1 ? 'measurement' : 'measurements'}
          </span>
        </div>
      </div>

      {/* Measurements Table Card with Contained Responsive Scrolling & Card View */}
      <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider text-stone-800 dark:text-slate-200">
            Measured Values ({measurements.length})
          </h3>
          <span className="text-xs sm:text-sm text-stone-400 dark:text-slate-500">
            Laboratory test observations
          </span>
        </div>

        {/* Desktop / Tablet Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-[#0F172A]/70 text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                <th className="py-4 px-6">Test</th>
                <th className="py-4 px-6">Value</th>
                <th className="py-4 px-6">Unit</th>
                <th className="py-4 px-6">Reference Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-slate-800 text-sm sm:text-base">
              {measurements.map((m) => {
                const displayVal =
                  m.value_numeric !== null ? formatValue(m.value_numeric) : m.value_text || '—'
                const refDisplay = formatReferenceRange(m.reference_min, m.reference_max, m.reference_text)

                return (
                  <tr key={m.id} className="hover:bg-stone-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-stone-900 dark:text-slate-100 text-base sm:text-lg">
                        {m.test_name_normalized}
                      </div>
                      {m.test_name_raw.toLowerCase() !== m.test_name_normalized.toLowerCase() && (
                        <div className="text-xs sm:text-sm text-stone-400 dark:text-slate-500 font-mono">
                          Raw: {m.test_name_raw}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 font-black text-stone-900 dark:text-slate-100 font-mono text-lg sm:text-xl">
                      {displayVal}
                    </td>
                    <td className="py-4 px-6 text-stone-500 dark:text-slate-400 text-sm sm:text-base font-mono">
                      {m.unit || '—'}
                    </td>
                    <td className="py-4 px-6 text-stone-600 dark:text-slate-400 text-xs sm:text-sm font-mono">
                      {refDisplay}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Card View for small screens (<640px) */}
        <div className="sm:hidden divide-y divide-stone-100 dark:divide-slate-800">
          {measurements.map((m) => {
            const displayVal =
              m.value_numeric !== null ? formatValue(m.value_numeric) : m.value_text || '—'
            const refDisplay = formatReferenceRange(m.reference_min, m.reference_max, m.reference_text)

            return (
              <div key={m.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-stone-900 dark:text-slate-100">
                    {m.test_name_normalized}
                  </span>
                  <span className="font-black text-lg text-stone-900 dark:text-slate-100 font-mono">
                    {displayVal} {m.unit || ''}
                  </span>
                </div>
                {m.test_name_raw.toLowerCase() !== m.test_name_normalized.toLowerCase() && (
                  <div className="text-xs text-stone-400 dark:text-slate-500 font-mono">
                    Raw: {m.test_name_raw}
                  </div>
                )}
                <div className="text-xs text-stone-500 dark:text-slate-400 font-mono">
                  Ref: {refDisplay}
                </div>
              </div>
            )
          })}
        </div>

        {measurements.length === 0 && (
          <div className="py-12 text-center text-sm text-stone-400 dark:text-slate-500">
            No measurements recorded for this report.
          </div>
        )}
      </div>
    </div>
  )
}
