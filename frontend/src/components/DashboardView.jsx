import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function DashboardView({ onOpenAddReport, onSelectReport, onGoToReports }) {
  const [stats, setStats] = useState({
    totalReports: 0,
    uniqueTests: 0,
    latestReportDate: null,
  })
  const [recentReports, setRecentReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)
      try {
        // 1. Fetch reports
        const { data: repData } = await supabase
          .from('reports')
          .select('id, report_date, lab_name, source_type, created_at')
          .order('report_date', { ascending: false })

        // 2. Fetch unique normalized tests
        const { data: measData } = await supabase
          .from('measurements')
          .select('test_name_normalized')

        const reportsList = repData || []
        const uniqueTestSet = new Set(
          (measData || []).map((m) => m.test_name_normalized.toLowerCase())
        )

        setStats({
          totalReports: reportsList.length,
          uniqueTests: uniqueTestSet.size,
          latestReportDate: reportsList[0]?.report_date || null,
        })
        setRecentReports(reportsList.slice(0, 3))
      } catch (err) {
        console.error('Error loading dashboard stats:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  return (
    <div className="space-y-8 max-w-5xl antialiased">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/80 pb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">
            Lab<span className="text-[#5B3FE0]">Δ</span> Dashboard
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            Overview of your lab report history and tracked biomarkers
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Reports */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Total Reports
          </span>
          <div className="text-3xl font-extrabold text-stone-900 font-mono">
            {loading ? '—' : stats.totalReports}
          </div>
          <p className="text-[11px] text-stone-400">Recorded laboratory panels</p>
        </div>

        {/* Unique Tests */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Tracked Markers
          </span>
          <div className="text-3xl font-extrabold text-[#5B3FE0] font-mono">
            {loading ? '—' : stats.uniqueTests}
          </div>
          <p className="text-[11px] text-stone-400">Unique normalized test markers</p>
        </div>

        {/* Latest Date */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Latest Report Date
          </span>
          <div className="text-xl font-bold text-stone-900 pt-1">
            {loading
              ? '—'
              : stats.latestReportDate
              ? new Date(stats.latestReportDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'None'}
          </div>
          <p className="text-[11px] text-stone-400">Most recent lab collection</p>
        </div>
      </div>

      {/* Recent Reports Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Recent Reports
          </h3>
          {stats.totalReports > 0 && (
            <button
              onClick={onGoToReports}
              className="text-xs font-semibold text-[#5B3FE0] hover:underline cursor-pointer"
            >
              View all reports →
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-stone-400">Loading recent panels...</div>
        ) : recentReports.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-xl p-8 text-center space-y-2">
            <p className="text-xs font-medium text-stone-600">No reports recorded yet</p>
            <button
              onClick={onOpenAddReport}
              className="text-xs font-semibold text-[#5B3FE0] hover:underline cursor-pointer"
            >
              Add your first report →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {recentReports.map((r) => (
              <div
                key={r.id}
                onClick={() => onSelectReport(r.id)}
                className="bg-white border border-stone-200/80 hover:border-[#5B3FE0]/60 rounded-xl p-4 shadow-2xs transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-stone-900 group-hover:text-[#5B3FE0] transition-colors">
                    {new Date(r.report_date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <p className="text-xs text-stone-500 font-medium">
                    {r.lab_name || 'Lab not specified'}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] uppercase font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                    {r.source_type}
                  </span>
                  <span className="text-stone-400 group-hover:text-[#5B3FE0] text-sm">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
