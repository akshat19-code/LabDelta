import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/formatting'
import { hasDemoData, loadDemoData } from '../lib/demoData'
import { useReportsData } from '../context/ReportsContext'

export default function ReportsView({ onOpenAddReport, onSelectReport, userId, showToast }) {
  const { reports: cachedReports = [], measurements = [], loading: contextLoading = false, isLoaded = false, refreshData, hasProvider = false } = useReportsData()

  const [localReports, setLocalReports] = useState([])
  const [localLoading, setLocalLoading] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [error, setError] = useState('')

  // Calculate measurement counts for reports in memory
  const reports = useMemo(() => {
    if (isLoaded || cachedReports.length > 0) {
      const counts = {}
      for (const m of measurements) {
        counts[m.report_id] = (counts[m.report_id] || 0) + 1
      }
      return cachedReports.map((r) => ({
        ...r,
        measurements: [{ count: counts[r.id] || 0 }],
      }))
    }
    return localReports
  }, [cachedReports, measurements, isLoaded, localReports])

  // Only show blocking loading state during initial cold fetch when no cached data exists
  const loading = (contextLoading && !isLoaded && cachedReports.length === 0) || localLoading

  const fetchReports = async () => {
    if (isLoaded) return
    setLocalLoading(true)
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
      setLocalReports(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load report history.')
    } finally {
      setLocalLoading(false)
    }
  }

  useEffect(() => {
    if (!hasProvider && !isLoaded && cachedReports.length === 0) {
      fetchReports()
    }
  }, [isLoaded, cachedReports.length, hasProvider])

  const handleLoadDemo = async () => {
    if (!userId || loadingDemo) return

    setLoadingDemo(true)
    try {
      const alreadyHas = await hasDemoData(userId)
      if (alreadyHas) {
        if (showToast) {
          showToast('Demo reports are already loaded.', 'info')
        }
        return
      }

      const res = await loadDemoData(userId)
      if (res.success) {
        if (refreshData) {
          await refreshData()
        } else {
          await fetchReports()
        }
        if (showToast) {
          showToast('Demo workspace ready — explore Compare and Trends.', 'success')
        }
      } else {
        if (showToast) {
          showToast(res.message || 'Failed to load demo data.', 'error')
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDemo(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5 antialiased">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3.5 border-b border-stone-200/80 dark:border-slate-800 pb-3 sm:pb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-lg sm:text-xl font-black flex items-center justify-center shrink-0">
            📋
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-900 dark:text-slate-100">
              Reports History
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 font-medium mt-0.5">
              Your recorded laboratory panels and historical diagnostic records.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenAddReport}
            className="btn-primary inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 sm:py-2 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
          >
            <span className="text-sm leading-none">+</span>
            <span>Add Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs sm:text-sm text-rose-700 dark:text-rose-300 animate-fade-in">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#131B2E] border border-stone-200/80 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 animate-pulse"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-28 bg-stone-200 dark:bg-slate-700 rounded-md"></div>
                  <div className="h-3 w-10 bg-stone-100 dark:bg-slate-800 rounded-md"></div>
                </div>
                <div className="h-3 w-36 bg-stone-100 dark:bg-slate-800 rounded-md"></div>
              </div>
              <div className="flex items-center justify-between sm:justify-end sm:space-x-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-slate-800">
                <div className="space-y-0.5 text-left sm:text-right">
                  <div className="h-3.5 w-20 bg-stone-200 dark:bg-slate-700 rounded-md"></div>
                  <div className="h-2.5 w-24 bg-stone-100 dark:bg-slate-800 rounded-md"></div>
                </div>
                <div className="h-3.5 w-3.5 bg-stone-100 dark:bg-slate-800 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        /* Empty State with Section AK copy & watermark glyph */
        <div className="relative overflow-hidden bg-white dark:bg-[#131B2E] border border-dashed border-stone-300 dark:border-slate-800 rounded-2xl p-5 sm:p-8 text-center space-y-3.5 max-w-xl mx-auto my-3">
          <div className="watermark-glyph select-none pointer-events-none opacity-40">Δ</div>
          <div className="relative z-10 w-10 h-10 rounded-xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-xl font-black flex items-center justify-center mx-auto shadow-xs">
            Δ
          </div>
          <div className="relative z-10 space-y-0.5">
            <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-slate-100">No reports yet</h3>
            <p className="text-xs text-stone-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Upload a PDF or enter values manually to begin tracking changes.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={onOpenAddReport}
              className="btn-primary inline-flex items-center space-x-1.5 px-3.5 py-1.5 sm:py-2 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              <span>+ Add Your First Report</span>
            </button>
            <button
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              className="btn-secondary inline-flex items-center space-x-1.5 px-3.5 py-1.5 sm:py-2 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <span>✨ Explore with Demo Data</span>
            </button>
          </div>
        </div>
      ) : (
        /* Report History List */
        <div className="grid grid-cols-1 gap-2 sm:gap-2.5 animate-fade-in">
          {reports.map((report, idx) => {
            const count = report.measurements?.[0]?.count ?? 0
            return (
              <div
                key={report.id}
                onClick={() => onSelectReport(report.id)}
                className={`bg-white dark:bg-[#131B2E] border border-stone-200/80 dark:border-slate-800 hover:border-[#5B3FE0]/50 dark:hover:border-[#5B3FE0]/50 rounded-xl p-3 sm:p-3.5 lg:p-4 card-interactive cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 group stagger-${idx % 5}`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-slate-100 group-hover:text-[#5B3FE0] dark:group-hover:text-[#8266FA] transition-colors">
                      {formatDate(report.report_date)}
                    </span>
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md ${
                        report.source_type === 'demo'
                          ? 'bg-violet-50 dark:bg-violet-950/60 text-[#5B3FE0] dark:text-[#8266FA] border border-violet-200/70 dark:border-violet-800/60'
                          : report.source_type === 'pdf'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-400'
                      }`}
                    >
                      {report.source_type}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-slate-400 font-medium truncate max-w-xs sm:max-w-md">
                    {report.lab_name || 'Lab not specified'}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end sm:space-x-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-slate-800">
                  <div className="text-left sm:text-right">
                    <span className="text-xs sm:text-sm font-bold text-stone-800 dark:text-slate-200 block">
                      {count} {count === 1 ? 'measurement' : 'measurements'}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-stone-400 dark:text-slate-500 font-mono block">
                      Added {formatDate(report.created_at)}
                    </span>
                  </div>
                  <span className="text-stone-400 dark:text-slate-500 group-hover:text-[#5B3FE0] dark:group-hover:text-[#8266FA] group-hover:translate-x-1 transition-all text-base font-bold">
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
