import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { hasDemoData, loadDemoData } from '../lib/demoData'
import { formatDate } from '../lib/formatting'
import { handleSpotlightMouseMove } from '../lib/spotlight'
import { useReportsData } from '../context/ReportsContext'

// Hook for smooth integer count-up animation respecting prefers-reduced-motion
function useCountUp(target, duration = 500) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    // If target is 0 or invalid
    if (!target || typeof target !== 'number') {
      setCount(target || 0)
      return
    }

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) {
      setCount(target)
      return
    }

    let start = 0
    const startTime = performance.now()

    const updateCount = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(eased * target)
      setCount(current)

      if (progress < 1) {
        requestAnimationFrame(updateCount)
      } else {
        setCount(target)
      }
    }

    const animId = requestAnimationFrame(updateCount)
    return () => cancelAnimationFrame(animId)
  }, [target, duration])

  return count
}

export default function DashboardView({
  onOpenAddReport,
  onSelectReport,
  onGoToReports,
  onGoToCompare,
  onGoToTrends,
  userId,
  showToast,
}) {
  const { reports = [], measurements = [], loading: contextLoading = false, isLoaded = false, refreshData, hasProvider = false } = useReportsData()

  const [loadingDemo, setLoadingDemo] = useState(false)
  const [localStats, setLocalStats] = useState({
    totalReports: 0,
    uniqueTests: 0,
    latestReportDate: null,
  })
  const [localRecentReports, setLocalRecentReports] = useState([])
  const [localLoading, setLocalLoading] = useState(false)
  const [localDemoLoaded, setLocalDemoLoaded] = useState(false)

  // Derived stats from cached context
  const stats = useMemo(() => {
    if (isLoaded || reports.length > 0) {
      const uniqueTestSet = new Set(
        (measurements || []).map((m) => m.test_name_normalized?.toLowerCase()).filter(Boolean)
      )
      return {
        totalReports: reports.length,
        uniqueTests: uniqueTestSet.size,
        latestReportDate: reports[0]?.report_date || null,
      }
    }
    return localStats
  }, [reports, measurements, isLoaded, localStats])

  const recentReports = useMemo(() => {
    if (isLoaded || reports.length > 0) {
      return reports.slice(0, 4)
    }
    return localRecentReports
  }, [reports, isLoaded, localRecentReports])

  const demoLoaded = useMemo(() => {
    if (isLoaded || reports.length > 0) {
      return reports.some((r) => r.source_type === 'demo')
    }
    return localDemoLoaded
  }, [reports, isLoaded, localDemoLoaded])

  // Only show blocking loading state during initial cold fetch when no cached data exists
  const loading = (contextLoading && !isLoaded && reports.length === 0) || localLoading

  const animatedReports = useCountUp(stats.totalReports)
  const animatedTests = useCountUp(stats.uniqueTests)

  // Fallback direct fetch ONLY if used outside ReportsDataProvider
  const loadDashboardData = async () => {
    if (isLoaded) return
    setLocalLoading(true)
    try {
      const { data: repData, error: repErr } = await supabase
        .from('reports')
        .select('id, report_date, lab_name, source_type, created_at')
        .order('report_date', { ascending: false })

      if (repErr) throw repErr

      const { data: measData, error: measErr } = await supabase
        .from('measurements')
        .select('test_name_normalized')

      if (measErr) throw measErr

      const reportsList = repData || []
      const uniqueTestSet = new Set(
        (measData || []).map((m) => m.test_name_normalized.toLowerCase())
      )

      setLocalStats({
        totalReports: reportsList.length,
        uniqueTests: uniqueTestSet.size,
        latestReportDate: reportsList[0]?.report_date || null,
      })
      setLocalRecentReports(reportsList.slice(0, 4))

      if (userId) {
        const isDemoPresent = await hasDemoData(userId)
        setLocalDemoLoaded(isDemoPresent)
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err)
    } finally {
      setLocalLoading(false)
    }
  }

  useEffect(() => {
    if (!hasProvider && !isLoaded && reports.length === 0) {
      loadDashboardData()
    }
  }, [userId, isLoaded, reports.length, hasProvider])

  // Handle Demo Data loading
  const handleLoadDemo = async () => {
    if (!userId || loadingDemo) return

    // If demo data already exists, alert the user
    if (demoLoaded) {
      if (showToast) {
        showToast('Demo reports are already present in your workspace.', 'info', {
          label: 'View Compare',
          onClick: onGoToCompare,
        })
      }
      return
    }

    setLoadingDemo(true)
    try {
      const res = await loadDemoData(userId)
      if (res.success) {
        if (refreshData) {
          await refreshData()
        } else {
          await loadDashboardData()
        }
        if (showToast) {
          showToast('Demo workspace ready — explore Compare and Trends.', 'success', {
            label: 'View Compare',
            onClick: onGoToCompare,
          })
        }
      } else {
        if (showToast) {
          showToast(res.message || 'Failed to load demo data.', 'error')
        }
      }
    } catch (err) {
      console.error('Demo loading error:', err)
    } finally {
      setLoadingDemo(false)
    }
  }

  return (
    <div className="space-y-8 antialiased">
      {/* Welcome Banner & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/80 dark:border-slate-800 pb-6">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-2xl font-black flex items-center justify-center shrink-0">
            📊
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-slate-100">
              Lab<span className="text-[#5B3FE0]">Δ</span> Overview
            </h2>
            <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 font-medium mt-1">
              Track laboratory trends, upload panels, and compute baseline deltas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Demo Data CTA — only displayed before demo data exists */}
          {!demoLoaded && (
            <button
              type="button"
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              className="btn-secondary group inline-flex items-center justify-center space-x-2 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold shadow-xs cursor-pointer"
              title="Load 4 synthetic demo reports"
            >
              {loadingDemo ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading Demo...</span>
                </>
              ) : (
                <>
                  <span className="inline-block transition-transform group-hover:scale-125 duration-200">✨</span>
                  <span>Explore Demo</span>
                </>
              )}
            </button>
          )}

          {/* Add Report Primary CTA */}
          <button
            onClick={onOpenAddReport}
            className="btn-primary inline-flex items-center justify-center space-x-2 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold shadow-xs"
          >
            <span className="text-base font-bold leading-none">+</span>
            <span>Add Report</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Strip */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 animate-fade-in">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 space-y-3 animate-shimmer">
              <div className="h-4 w-28 bg-stone-200/70 dark:bg-slate-700/60 rounded"></div>
              <div className="h-12 w-20 bg-stone-200/70 dark:bg-slate-700/60 rounded"></div>
              <div className="h-4 w-36 bg-stone-200/50 dark:bg-slate-700/40 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          {/* Total Reports */}
          <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-2 card-interactive group">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-400 dark:text-slate-400 block">
                Total Reports
              </span>
              <span className="text-stone-400 dark:text-slate-500 text-xl transition-transform group-hover:scale-110">📋</span>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 dark:text-slate-100 font-mono">
              {animatedReports}
            </div>
            <p className="text-sm text-stone-400 dark:text-slate-500 font-medium">Recorded laboratory panels</p>
          </div>

          {/* Unique Tests */}
          <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-2 card-interactive group">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-400 dark:text-slate-400 block">
                Tracked Measurements
              </span>
              <span className="text-[#5B3FE0] dark:text-[#8266FA] text-xl transition-transform group-hover:scale-110">🔬</span>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#5B3FE0] dark:text-[#8266FA] font-mono">
              {animatedTests}
            </div>
            <p className="text-sm text-stone-400 dark:text-slate-500 font-medium">Unique test measurements</p>
          </div>

          {/* Latest Date */}
          <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-2 card-interactive group">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-400 dark:text-slate-400 block">
                Latest Report Date
              </span>
              <span className="text-stone-400 dark:text-slate-500 text-xl transition-transform group-hover:scale-110">📅</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-slate-100 font-mono pt-1">
              {stats.latestReportDate ? formatDate(stats.latestReportDate) : 'None'}
            </div>
            <p className="text-sm text-stone-400 dark:text-slate-500 font-medium">Most recent report date</p>
          </div>
        </div>
      )}

      {/* Quick Action Navigation Strip (Upload → Compare → Understand Change) with Spotlight */}
      <div 
        onMouseMove={handleSpotlightMouseMove}
        className="spotlight-surface relative overflow-hidden bg-gradient-to-r from-violet-50/80 via-white to-stone-50/60 dark:from-[#131B2E] dark:via-[#162038] dark:to-[#0F172A] border border-violet-200/60 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 card-interactive"
      >
        <div className="absolute -right-4 -bottom-6 text-[#5B3FE0]/5 dark:text-[#5B3FE0]/10 text-9xl font-black select-none pointer-events-none">
          Δ
        </div>
        <div className="space-y-1.5 relative z-10">
          <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-slate-100">
            Compare Lab Reports. See What Changed.
          </h3>
          <p className="text-sm sm:text-base text-stone-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Select two reports to instantly compute baseline differences (Δ), identify newly emerged or missing tests, and observe marker trajectories over time.
          </p>
        </div>
        <div className="flex items-center space-x-3 shrink-0 relative z-10">
          <button
            onClick={onGoToCompare}
            className="group px-5 py-3 btn-primary text-sm sm:text-base font-semibold shadow-xs flex items-center space-x-2"
          >
            <span>Launch Compare</span>
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </button>
          <button
            onClick={onGoToTrends}
            className="px-5 py-3 btn-secondary text-sm sm:text-base font-semibold shadow-xs"
          >
            View Trends
          </button>
        </div>
      </div>

      {/* Recent Reports Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-stone-600 dark:text-slate-400">
            Recent Reports
          </h3>
          {stats.totalReports > 0 && (
            <button
              onClick={onGoToReports}
              className="text-sm sm:text-base font-semibold text-[#5B3FE0] dark:text-[#8266FA] hover:underline cursor-pointer group flex items-center space-x-1"
            >
              <span>View all reports ({stats.totalReports})</span>
              <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 animate-fade-in">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex items-center justify-between animate-shimmer">
                <div className="space-y-2">
                  <div className="h-5 w-36 bg-stone-200/70 dark:bg-slate-700/60 rounded"></div>
                  <div className="h-4 w-52 bg-stone-200/50 dark:bg-slate-700/40 rounded"></div>
                </div>
                <div className="h-5 w-24 bg-stone-200/50 dark:bg-slate-700/40 rounded"></div>
              </div>
            ))}
          </div>
        ) : recentReports.length === 0 ? (
          /* Empty State with Watermark */
          <div className="relative overflow-hidden bg-white dark:bg-[#131B2E] border border-dashed border-stone-300 dark:border-slate-800 rounded-3xl p-8 sm:p-14 text-center space-y-4">
            <div className="absolute -right-2 -bottom-6 text-stone-200/25 dark:text-slate-800/40 text-9xl font-black select-none pointer-events-none">
              Δ
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-3xl font-black flex items-center justify-center mx-auto delta-badge">
              Δ
            </div>
            <div className="space-y-1.5 relative z-10">
              <h4 className="text-lg font-bold text-stone-900 dark:text-slate-100">No reports recorded yet</h4>
              <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Upload a PDF, enter values manually, or explore LabΔ with synthetic demo data.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 relative z-10">
              <button
                onClick={onOpenAddReport}
                className="btn-primary px-5 py-3 text-sm sm:text-base font-semibold shadow-xs"
              >
                + Add First Report
              </button>
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="btn-secondary px-5 py-3 text-sm sm:text-base font-semibold shadow-xs"
              >
                ✨ Load Demo Workspace
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {recentReports.map((r, idx) => (
              <div
                key={r.id}
                onClick={() => onSelectReport(r.id)}
                className={`group bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs card-interactive flex items-center justify-between cursor-pointer stagger-${idx % 4}`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-base sm:text-lg font-bold text-stone-900 dark:text-slate-100 group-hover:text-[#5B3FE0] dark:group-hover:text-[#8266FA] transition-colors">
                      {formatDate(r.report_date)}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                        r.source_type === 'demo'
                          ? 'bg-violet-100/70 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60'
                          : r.source_type === 'pdf'
                          ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-400'
                      }`}
                    >
                      {r.source_type}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 font-medium truncate max-w-xs sm:max-w-md">
                    {r.lab_name || 'Unspecified Laboratory'}
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-stone-400 dark:text-slate-500 group-hover:text-[#5B3FE0] dark:group-hover:text-[#8266FA] transition-colors shrink-0">
                  <span className="text-sm sm:text-base font-semibold hidden sm:inline">View details</span>
                  <span className="text-lg transition-transform duration-150 group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
