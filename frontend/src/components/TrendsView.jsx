import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { buildTrendsSummary, computeYAxisDomain } from '../lib/trends'
import { formatValue, formatDelta, formatPercent, formatDate, cleanLabName } from '../lib/formatting'
import { useReportsData } from '../context/ReportsContext'

/**
 * Custom SVG Dot component for Recharts line chart
 * Deterministically renders discrete observation points with subtle range-status differentiation.
 * Avoids conventional green=healthy / red=unhealthy semantics.
 * - Within range: violet/product accent (#5B3FE0)
 * - Below range: amber treatment with inner marker
 * - Above range: amber treatment with inner marker
 * - Unavailable: neutral gray ring
 */
function CustomTrendDot(props) {
  const { cx, cy, payload, active, theme } = props
  if (cx === undefined || cy === undefined || !payload) return null

  const statusKey = payload.rangeStatusKey || 'unavailable'
  const isDark = theme === 'dark'
  const r = active ? 7 : 5.5
  const strokeColor = isDark ? '#0B0F19' : '#ffffff'
  const strokeWidth = active ? 2.5 : 2

  if (statusKey === 'within') {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#5B3FE0"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    )
  }

  if (statusKey === 'below') {
    const amberFill = isDark ? '#F59E0B' : '#D97706'
    const markFill = isDark ? '#0B0F19' : '#FFFFFF'
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={amberFill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        <polygon
          points={`${cx - 2.5},${cy - 1.2} ${cx + 2.5},${cy - 1.2} ${cx},${cy + 2.2}`}
          fill={markFill}
        />
      </g>
    )
  }

  if (statusKey === 'above') {
    const amberFill = isDark ? '#F59E0B' : '#D97706'
    const markFill = isDark ? '#0B0F19' : '#FFFFFF'
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={amberFill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        <polygon
          points={`${cx},${cy - 2.2} ${cx - 2.5},${cy + 1.2} ${cx + 2.5},${cy + 1.2}`}
          fill={markFill}
        />
      </g>
    )
  }

  // Unavailable: neutral slate ring
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={isDark ? '#1E293B' : '#FFFFFF'}
      stroke={isDark ? '#64748B' : '#94A3B8'}
      strokeWidth={strokeWidth}
    />
  )
}

/**
 * Custom Tooltip component for Recharts line chart
 */
function TrendTooltip({ active, payload, unit, theme }) {
  if (active && payload && payload.length) {
    const point = payload[0].payload

    let statusText = 'Range unavailable'
    let statusBadgeClass = 'text-stone-600 dark:text-slate-400 bg-stone-100 dark:bg-slate-800'

    if (point.rangeStatusKey === 'within') {
      statusText = 'Within provided range'
      statusBadgeClass = 'text-[#5B3FE0] dark:text-[#8266FA] bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20'
    } else if (point.rangeStatusKey === 'below') {
      statusText = 'Below provided range'
      statusBadgeClass = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/60'
    } else if (point.rangeStatusKey === 'above') {
      statusText = 'Above provided range'
      statusBadgeClass = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/60'
    }

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-stone-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl text-xs sm:text-sm space-y-2.5 min-w-64 max-w-xs z-50 animate-scale-in">
        <div className="border-b border-stone-100 dark:border-slate-800 pb-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-900 dark:text-slate-100 text-sm">{point.formattedDate}</span>
            {point.isDuplicateDateAndLab && (
              <span className="text-[10px] font-semibold text-stone-400 dark:text-slate-500 font-mono">
                Obs {point.dateLabIndex} of {point.dateOccurrenceCount}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5 truncate">
            <span className="text-xs text-stone-500 dark:text-slate-400 font-medium truncate">
              {cleanLabName(point.labName)}
            </span>
            {point.sourceType === 'demo' && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-violet-50 dark:bg-violet-950/60 text-[#5B3FE0] dark:text-[#8266FA] border border-violet-200/70 dark:border-violet-800/60 shrink-0">
                DEMO
              </span>
            )}
          </div>
        </div>
        <div className="flex items-baseline justify-between pt-0.5">
          <span className="text-stone-500 dark:text-slate-400 font-medium">Observed</span>
          <span className="font-extrabold text-stone-900 dark:text-slate-100 text-base sm:text-lg font-mono">
            {formatValue(point.value)} {unit}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-xs text-stone-500 dark:text-slate-400 pt-1 border-t border-stone-100 dark:border-slate-800">
          <span className="font-medium">Reference Range</span>
          <span className="font-semibold text-stone-700 dark:text-slate-300 font-mono">
            {point.refDisplay || 'Not provided'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100 dark:border-slate-800">
          <span className="text-stone-500 dark:text-slate-400 font-medium">Status</span>
          <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${statusBadgeClass}`}>
            {statusText}
          </span>
        </div>
      </div>
    )
  }
  return null
}

export default function TrendsView({ onOpenAddReport, theme = 'light' }) {
  const { reports: cachedReports = [], measurements: cachedMeasurements = [], loading: contextLoading = false, isLoaded = false, hasProvider = false } = useReportsData()

  const [loading, setLoading] = useState(contextLoading && !isLoaded && cachedReports.length === 0)
  const [error, setError] = useState('')
  const [summaryData, setSummaryData] = useState(null)
  const [selectedTestName, setSelectedTestName] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch all reports and measurements for authenticated user (fallback)
  const fetchTrendsData = async () => {
    if (isLoaded) return
    setLoading(true)
    setError('')
    try {
      // 1. Fetch reports
      const { data: reports, error: reportsErr } = await supabase
        .from('reports')
        .select('id, report_date, lab_name, created_at, source_type')
        .order('report_date', { ascending: true })

      if (reportsErr) throw reportsErr

      // 2. Fetch measurements
      const { data: measurements, error: measErr } = await supabase
        .from('measurements')
        .select('*')

      if (measErr) throw measErr

      // 3. Process trends data
      const summary = buildTrendsSummary(reports || [], measurements || [])
      setSummaryData(summary)

      // 4. Default select first eligible test if available
      if (summary.eligibleTests.length > 0) {
        const firstTest = summary.eligibleTests[0]
        setSelectedTestName(firstTest.testName)
        setSelectedUnit(firstTest.defaultUnit)
      } else {
        setSelectedTestName('')
        setSelectedUnit('')
      }
    } catch (err) {
      setError(err.message || 'Failed to load trends data.')
    } finally {
      setLoading(false)
    }
  }

  // Derive trends summary synchronously from cached reports & measurements
  useEffect(() => {
    if (isLoaded || cachedReports.length > 0) {
      const chronological = [...cachedReports].sort((a, b) => (a.report_date > b.report_date ? 1 : -1))
      const summary = buildTrendsSummary(chronological, cachedMeasurements)
      setSummaryData(summary)
      setLoading(false)

      if (summary.eligibleTests.length > 0) {
        setSelectedTestName((prev) => {
          if (prev && summary.eligibleTests.some((t) => t.testName === prev)) return prev
          return summary.eligibleTests[0].testName
        })
        setSelectedUnit((prev) => {
          const matchTest = summary.eligibleTests.find((t) => t.testName === (selectedTestName || summary.eligibleTests[0].testName))
          if (matchTest && prev && matchTest.unitGroups.some((g) => g.unitLabel === prev)) return prev
          return matchTest?.defaultUnit || ''
        })
      } else {
        setSelectedTestName('')
        setSelectedUnit('')
      }
      return
    }

    if (!hasProvider) {
      fetchTrendsData()
    }
  }, [cachedReports, cachedMeasurements, isLoaded, hasProvider])

  // Find currently selected test data
  const currentTest = useMemo(() => {
    if (!summaryData || !selectedTestName) return null
    return summaryData.eligibleTests.find((t) => t.testName === selectedTestName) || null
  }, [summaryData, selectedTestName])

  // Find active unit group for current test
  const activeUnitGroup = useMemo(() => {
    if (!currentTest) return null
    return (
      currentTest.unitGroups.find((g) => g.unitLabel === selectedUnit) ||
      currentTest.primaryGroup ||
      currentTest.unitGroups[0]
    )
  }, [currentTest, selectedUnit])

  // Excluded measurements for the active unit group
  const excludedInfo = useMemo(() => {
    if (!currentTest || !activeUnitGroup) return null
    const otherGroups = currentTest.unitGroups.filter((g) => g.unitLabel !== activeUnitGroup.unitLabel)
    if (otherGroups.length === 0) return null
    const otherPointsCount = otherGroups.reduce((acc, g) => acc + g.pointsCount, 0)
    const otherUnitLabels = otherGroups.map((g) => g.unitLabel).join(', ')
    return {
      count: otherPointsCount,
      units: otherUnitLabels,
    }
  }, [currentTest, activeUnitGroup])

  // Filtered test list based on search
  const filteredTests = useMemo(() => {
    if (!summaryData) return []
    if (!searchQuery.trim()) return summaryData.eligibleTests
    const q = searchQuery.toLowerCase().trim()
    return summaryData.eligibleTests.filter((t) => t.testName.toLowerCase().includes(q))
  }, [summaryData, searchQuery])

  // Handle selecting a test
  const handleSelectTest = (test) => {
    setSelectedTestName(test.testName)
    setSelectedUnit(test.defaultUnit)
  }

  // ----------------------------------------------------
  // LOADING STATE (Shimmer Skeletons)
  // ----------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8 antialiased">
        <div className="border-b border-stone-200/80 pb-6 flex items-center justify-between">
          <div className="space-y-2 animate-pulse">
            <div className="h-8 w-48 bg-stone-200 rounded-xl"></div>
            <div className="h-4 w-72 bg-stone-100 rounded-md"></div>
          </div>
          <div className="h-9 w-28 bg-stone-200 rounded-xl animate-pulse"></div>
        </div>

        {/* Skeletons for top metric strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 space-y-2 animate-pulse">
              <div className="h-3 w-20 bg-stone-200 rounded-md"></div>
              <div className="h-7 w-16 bg-stone-200 rounded-md"></div>
              <div className="h-3 w-28 bg-stone-100 rounded-md"></div>
            </div>
          ))}
        </div>

        {/* Skeleton for test selector */}
        <div className="bg-white border border-stone-200/90 rounded-3xl p-5 sm:p-6 space-y-4 animate-pulse">
          <div className="h-4 w-40 bg-stone-200 rounded-md"></div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-24 bg-stone-100 rounded-xl"></div>
            ))}
          </div>
        </div>

        {/* Skeleton for chart card */}
        <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 space-y-6 animate-pulse">
          <div className="h-6 w-36 bg-stone-200 rounded-md"></div>
          <div className="h-72 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // ERROR STATE
  // ----------------------------------------------------
  if (error) {
    return (
      <div className="space-y-4 antialiased animate-fade-in">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
          {error}
        </div>
        <button
          onClick={fetchTrendsData}
          className="btn-primary px-4 py-2 text-white text-xs font-semibold rounded-xl"
        >
          Retry
        </button>
      </div>
    )
  }

  // ----------------------------------------------------
  // EMPTY STATE CASE A: NO REPORTS AT ALL
  // ----------------------------------------------------
  if (!summaryData || summaryData.totalReportsCount === 0) {
    return (
      <div className="space-y-6 antialiased">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/80 dark:border-slate-800 pb-6">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-2xl font-black flex items-center justify-center shrink-0">
              📈
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-slate-100">
                Measurement Trends
              </h2>
              <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 font-medium mt-1">
                Chronological trajectories for repeated laboratory observations.
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-[#131B2E] border border-dashed border-stone-300 dark:border-slate-800 rounded-3xl p-10 sm:p-14 text-center space-y-5 max-w-xl mx-auto my-8 shadow-xs">
          <div className="watermark-glyph select-none pointer-events-none opacity-40">Δ</div>
          <div className="relative z-10 w-16 h-16 rounded-2xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-3xl font-black flex items-center justify-center mx-auto shadow-xs">
            📈
          </div>
          <div className="relative z-10 space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-slate-100">No report history yet</h3>
            <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Add your first laboratory reports to observe historical measurement trajectories and changes over time.
            </p>
          </div>
          <div className="relative z-10 pt-2">
            <button
              onClick={onOpenAddReport}
              className="btn-primary inline-flex items-center space-x-2 px-5 py-3 text-white text-sm sm:text-base font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              <span>+ Add Your First Report</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // EMPTY STATE CASE B: INSUFFICIENT REPEATED MEASUREMENTS
  // ----------------------------------------------------
  if (!summaryData.hasEligibleTests) {
    return (
      <div className="space-y-6 antialiased">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/80 dark:border-slate-800 pb-6">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-2xl font-black flex items-center justify-center shrink-0">
              📈
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-slate-100">
                Measurement Trends
              </h2>
              <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 font-medium mt-1">
                Chronological trajectories for repeated laboratory observations.
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-[#131B2E] border border-stone-200/80 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-5 max-w-xl mx-auto my-8 shadow-xs">
          <div className="watermark-glyph select-none pointer-events-none opacity-40">Δ</div>
          <div className="relative z-10 w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 text-3xl flex items-center justify-center mx-auto">
            ⏳
          </div>
          <div className="relative z-10 space-y-2">
            <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-slate-100">
              Insufficient Repeated Measurements
            </h3>
            <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Add another report containing the same measurement to unlock Trends. You currently have {summaryData.totalReportsCount} {summaryData.totalReportsCount === 1 ? 'report' : 'reports'}, but none share repeated markers with compatible units yet.
            </p>
          </div>

          <div className="relative z-10 pt-2">
            <button
              onClick={onOpenAddReport}
              className="btn-primary inline-flex items-center space-x-2 px-5 py-3 text-white text-sm sm:text-base font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              <span>+ Add Another Report</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const yDomain = activeUnitGroup ? computeYAxisDomain(activeUnitGroup.points) : [0, 100]

  return (
    <div className="space-y-4 sm:space-y-5 antialiased">
      {/* 1. Header & Branding */}
      <div className="border-b border-stone-200/80 dark:border-slate-800 pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-lg sm:text-xl font-black flex items-center justify-center shrink-0">
            📈
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-900 dark:text-slate-100">
              Measurement Trends
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 font-medium mt-0.5">
              Chronological trajectories for repeated laboratory observations.
            </p>
          </div>
        </div>
        <button
          onClick={onOpenAddReport}
          className="btn-primary inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 sm:py-2 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <span className="text-sm leading-none">+</span>
          <span>Add Report</span>
        </button>
      </div>

      {/* 2. Top Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3">
        <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 lg:p-4 card-interactive space-y-0.5">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
            Tracked Tests
          </span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-stone-900 dark:text-slate-100 font-mono">
            {formatValue(summaryData.eligibleTests.length)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-slate-500 font-medium">Tests with ≥2 repeated points</p>
        </div>

        <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 lg:p-4 card-interactive space-y-0.5">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
            Reports Used
          </span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-[#5B3FE0] dark:text-[#8266FA] font-mono">
            {formatValue(summaryData.totalReportsCount)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-slate-500 font-medium">Total historical reports</p>
        </div>

        <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 lg:p-4 card-interactive space-y-0.5">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
            Selected Test
          </span>
          <div className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-slate-100 truncate pt-0.5">
            {currentTest?.testName || 'None'}
          </div>
          <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-slate-500 font-medium">
            {activeUnitGroup?.unitLabel ? `Unit: ${activeUnitGroup.unitLabel}` : 'Active plot'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 lg:p-4 card-interactive space-y-0.5">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
            Plotted Points
          </span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatValue(activeUnitGroup?.pointsCount || 0)}
          </div>
          <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-slate-500 font-medium">Observations on trend line</p>
        </div>
      </div>

      {/* 3. Searchable Test Selector Strip */}
      <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4.5 lg:p-5 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-slate-100">
              Select Measurement to Plot
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
              Choose from tests with repeated measurements
            </p>
          </div>
          {summaryData.eligibleTests.length > 3 && (
            <div className="w-full sm:w-56">
              <input
                type="text"
                placeholder="Filter tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1 bg-stone-50 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-700 rounded-xl text-xs text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] focus:border-[#5B3FE0] transition-all"
              />
            </div>
          )}
        </div>

        {/* Test Selector Pills */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {filteredTests.map((test) => {
            const isSelected = selectedTestName === test.testName
            return (
              <button
                key={test.testName}
                onClick={() => handleSelectTest(test)}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center space-x-1.5 btn-press ${
                  isSelected
                    ? 'bg-[#5B3FE0] text-white shadow-xs scale-[1.02]'
                    : 'bg-stone-50 dark:bg-slate-900/80 hover:bg-stone-100 dark:hover:bg-slate-800 hover:border-stone-300 dark:hover:border-slate-700 text-stone-700 dark:text-slate-300 border border-stone-200 dark:border-slate-800'
                }`}
              >
                <span>{test.testName}</span>
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-md transition-colors ${
                    isSelected
                      ? 'bg-white/25 text-white'
                      : 'bg-stone-200/80 dark:bg-slate-800 text-stone-600 dark:text-slate-400'
                  }`}
                >
                  {test.pointsCount}
                </span>
              </button>
            )
          })}
          {filteredTests.length === 0 && (
            <p className="text-xs text-stone-400 dark:text-slate-500 py-1">No matching tests found.</p>
          )}
        </div>
      </div>

      {/* 4. Chart Card with Unit Selector & Mathematical Direction Strip */}
      {currentTest && activeUnitGroup && (
        <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden space-y-4 p-3.5 sm:p-4.5 lg:p-5">
          {/* Chart Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-slate-100">
                  {currentTest.testName}
                </h3>
                {activeUnitGroup.unit && (
                  <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 rounded-lg">
                    {activeUnitGroup.unit}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                Observed values over time across laboratory reports
              </p>
            </div>

            {/* Unit Selector (if multiple units exist for this test) */}
            {currentTest.unitGroups.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 bg-stone-50 dark:bg-slate-900/80 p-1 rounded-xl border border-stone-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-stone-500 dark:text-slate-400 pl-1">Unit:</span>
                {currentTest.unitGroups.map((g) => (
                  <button
                    key={g.unitLabel}
                    onClick={() => setSelectedUnit(g.unitLabel)}
                    className={`min-h-[38px] sm:min-h-0 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer btn-press flex items-center ${
                      activeUnitGroup.unitLabel === g.unitLabel
                        ? 'bg-[#5B3FE0] text-white shadow-2xs'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {g.unitLabel} ({g.pointsCount})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Unit Mismatch Exclusion Warning Banner */}
          {excludedInfo && (
            <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-xl text-xs sm:text-sm text-amber-900 dark:text-amber-300 flex items-start space-x-2 animate-fade-in">
              <span className="text-amber-500 font-bold shrink-0 text-sm">ℹ️</span>
              <p className="leading-relaxed">
                <span className="font-semibold">{excludedInfo.count} {excludedInfo.count === 1 ? 'measurement' : 'measurements'}</span> excluded from this chart because different units were detected ({excludedInfo.units}). Units are never combined onto the same line.
              </p>
            </div>
          )}

          {/* Direction Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-stone-50/70 dark:bg-[#0F172A]/70 p-3 rounded-xl border border-stone-200/60 dark:border-slate-800 text-xs">
            {/* First Value */}
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider block">
                First Recorded
              </span>
              <div className="font-bold text-stone-900 dark:text-slate-100 mt-0.5 font-mono text-xs sm:text-sm">
                {formatValue(activeUnitGroup.first.value)} {activeUnitGroup.unit}
              </div>
              <span className="text-[10px] text-stone-400 dark:text-slate-500 font-mono mt-0.5 block">
                {activeUnitGroup.first.formattedDate}
              </span>
            </div>

            {/* Latest Value */}
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider block">
                Latest Recorded
              </span>
              <div className="font-bold text-stone-900 dark:text-slate-100 mt-0.5 font-mono text-xs sm:text-sm">
                {formatValue(activeUnitGroup.latest.value)} {activeUnitGroup.unit}
              </div>
              <span className="text-[10px] text-stone-400 dark:text-slate-500 font-mono mt-0.5 block">
                {activeUnitGroup.latest.formattedDate}
              </span>
            </div>

            {/* Net Delta with formatting */}
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider block">
                Net Change (Δ)
              </span>
              <div className="font-black text-stone-900 dark:text-slate-100 mt-0.5 font-mono text-xs sm:text-sm flex items-center space-x-1.5">
                <span>Δ {formatDelta(activeUnitGroup.netDelta)}</span>
                {activeUnitGroup.direction === 'up' && (
                  <span className="text-xs font-bold inline-block animate-arrow-up text-stone-700 dark:text-slate-300">↑</span>
                )}
                {activeUnitGroup.direction === 'down' && (
                  <span className="text-xs font-bold inline-block animate-arrow-down text-stone-700 dark:text-slate-300">↓</span>
                )}
                {activeUnitGroup.direction === 'neutral' && (
                  <span className="text-xs font-bold inline-block text-stone-700 dark:text-slate-300">=</span>
                )}
              </div>
              <span className="text-[10px] text-stone-400 dark:text-slate-500 font-mono mt-0.5 block">Latest − First</span>
            </div>

            {/* Percentage Change with formatting */}
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider block">
                Percentage Change
              </span>
              <div className="font-bold text-stone-900 dark:text-slate-100 mt-0.5 font-mono text-xs sm:text-sm">
                {activeUnitGroup.percentUnavailable
                  ? 'Unavailable (base 0)'
                  : formatPercent(activeUnitGroup.percentChange)}
              </div>
              <span className="text-[10px] text-stone-400 dark:text-slate-500 font-mono mt-0.5 block">Relative trajectory</span>
            </div>
          </div>

          {/* Recharts Responsive Line Chart with Animation */}
          <div className="w-full pt-2 pb-1 space-y-2.5">
            <div className="w-full h-64 sm:h-72 lg:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={activeUnitGroup.points}
                  margin={{ top: 10, right: 20, left: -15, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} vertical={false} />
                  <XAxis
                    dataKey="chartTick"
                    stroke={theme === 'dark' ? '#475569' : '#94a3b8'}
                    tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    dy={8}
                  />
                  <YAxis
                    domain={yDomain}
                    stroke={theme === 'dark' ? '#475569' : '#94a3b8'}
                    tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                    tickLine={false}
                    dx={-5}
                  />
                  <Tooltip content={<TrendTooltip unit={activeUnitGroup.unit} theme={theme} />} />
                  <Line
                    type="linear"
                    dataKey="value"
                    stroke="#5B3FE0"
                    strokeWidth={2.5}
                    isAnimationActive={true}
                    animationDuration={450}
                    dot={<CustomTrendDot theme={theme} />}
                    activeDot={<CustomTrendDot active theme={theme} />}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Discrete Observation Range Status Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2.5 text-[11px] text-stone-500 dark:text-slate-400 border-t border-stone-100 dark:border-slate-800">
              <div className="flex items-center space-x-1.5">
                <svg width="10" height="10" viewBox="0 0 12 12" className="shrink-0">
                  <circle cx="6" cy="6" r="4.5" fill="#5B3FE0" />
                </svg>
                <span>Within provided range</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <svg width="10" height="10" viewBox="0 0 12 12" className="shrink-0">
                  <circle cx="6" cy="6" r="4.5" fill="#D97706" />
                  <polygon points="3.8,4.8 8.2,4.8 6,7.8" fill="#FFFFFF" />
                </svg>
                <span>Below provided range</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <svg width="10" height="10" viewBox="0 0 12 12" className="shrink-0">
                  <circle cx="6" cy="6" r="4.5" fill="#D97706" />
                  <polygon points="6,4.2 3.8,7.2 8.2,7.2" fill="#FFFFFF" />
                </svg>
                <span>Above provided range</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <svg width="10" height="10" viewBox="0 0 12 12" className="shrink-0">
                  <circle cx="6" cy="6" r="4" fill="none" stroke="#94A3B8" strokeWidth="2" />
                </svg>
                <span>Range unavailable</span>
              </div>
            </div>
          </div>

          {/* Chronological Data History Strip */}
          <div className="border-t border-stone-100 dark:border-slate-800 pt-3.5 sm:pt-4 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-slate-300">
              Chronological Observations ({activeUnitGroup.pointsCount})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
              {activeUnitGroup.points.map((pt, idx) => {
                let statusLabel = 'Range unavailable'
                let badgeStyle = 'text-stone-600 dark:text-slate-400 bg-stone-100 dark:bg-slate-800'
                if (pt.rangeStatusKey === 'within') {
                  statusLabel = 'Within range'
                  badgeStyle = 'text-[#5B3FE0] dark:text-[#8266FA] bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20'
                } else if (pt.rangeStatusKey === 'below') {
                  statusLabel = 'Below range'
                  badgeStyle = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/60'
                } else if (pt.rangeStatusKey === 'above') {
                  statusLabel = 'Above range'
                  badgeStyle = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/60'
                }

                return (
                  <div
                    key={pt.id || idx}
                    className="bg-stone-50/60 dark:bg-[#0F172A]/60 border border-stone-200/80 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1.5 card-interactive"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-stone-900 dark:text-slate-100 text-xs sm:text-sm">{pt.formattedDate}</span>
                        {pt.isDuplicateDateAndLab && (
                          <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-stone-200/80 dark:bg-slate-800 text-stone-600 dark:text-slate-400 font-mono">
                            #{pt.dateLabIndex}
                          </span>
                        )}
                      </div>
                      <span className="font-black text-stone-900 dark:text-slate-100 font-mono text-xs sm:text-sm">
                        {formatValue(pt.value)} {activeUnitGroup.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400">
                      <div className="flex items-center space-x-1 truncate max-w-[130px]">
                        <span className="truncate">{cleanLabName(pt.labName)}</span>
                        {pt.sourceType === 'demo' && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-violet-50 dark:bg-violet-950/60 text-[#5B3FE0] dark:text-[#8266FA] border border-violet-200/70 dark:border-violet-800/60 shrink-0">
                            DEMO
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-stone-600 dark:text-slate-400">
                        Ref: {pt.refDisplay || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 dark:border-slate-800/70">
                      <span className="text-[10px] text-stone-400 dark:text-slate-500 font-medium">Range Status</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${badgeStyle}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
