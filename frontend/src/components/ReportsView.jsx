import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ReportsView({ onOpenAddReport, onSelectReport }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchReports = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch reports with count of measurements
      const { data, error } = await supabase
        .from('reports')
        .select(`
          id,
          report_date,
          lab_name,
          source_type,
          created_at,
          measurements(count)
        `)
        .order('report_date', { ascending: false })

      if (error) throw error
      setReports(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load report history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  return (
    <div className="space-y-6 max-w-5xl antialiased">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/80 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">
            Reports
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Your laboratory report history
          </p>
        </div>
        <button
          onClick={onOpenAddReport}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#5B3FE0] hover:bg-[#4d34c7] text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <span>+</span>
          <span>Add Report</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium text-stone-500">Loading your reports...</p>
        </div>
      ) : reports.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-12 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-[#5B3FE0]/10 text-[#5B3FE0] text-2xl flex items-center justify-center mx-auto">
            Δ
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-stone-900">No reports yet</h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
              Add your first laboratory report to start tracking markers and seeing what changes over time.
            </p>
          </div>
          <button
            onClick={onOpenAddReport}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#5B3FE0] hover:bg-[#4d34c7] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span>+ Add Your First Report</span>
          </button>
        </div>
      ) : (
        /* Report History List */
        <div className="grid grid-cols-1 gap-3">
          {reports.map((report) => {
            const count = report.measurements?.[0]?.count ?? 0
            return (
              <div
                key={report.id}
                onClick={() => onSelectReport(report.id)}
                className="bg-white border border-stone-200/80 hover:border-[#5B3FE0]/60 rounded-xl p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-base text-stone-900 group-hover:text-[#5B3FE0] transition-colors">
                      {new Date(report.report_date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                      {report.source_type}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 font-medium">
                    {report.lab_name || 'Lab not specified'}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end sm:space-x-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-bold text-stone-800 block">
                      {count} {count === 1 ? 'measurement' : 'measurements'}
                    </span>
                    <span className="text-[11px] text-stone-400 font-mono">
                      Added {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-stone-400 group-hover:text-[#5B3FE0] group-hover:translate-x-0.5 transition-all text-sm font-bold">
                    →
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
