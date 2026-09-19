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

/**
 * Custom Tooltip component for Recharts line chart
 */
function TrendTooltip({ active, payload, unit }) {
  if (active && payload && payload.length) {
    const point = payload[0].payload
    return (
      <div className="bg-white/95 backdrop-blur-xs border border-stone-200 rounded-xl p-3 shadow-lg text-xs space-y-1.5 min-w-44 z-50">
        <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
          <span className="font-bold text-stone-900">{point.formattedDate}</span>
          <span className="text-[10px] text-stone-400 font-mono">
            {point.labName}
          </span>
        </div>
        <div className="flex items-baseline justify-between pt-0.5">
          <span className="text-stone-500 font-medium">Observed Value:</span>
          <span className="font-extrabold text-stone-900 text-sm font-mono">
            {point.value} {unit}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-[11px] text-stone-500 pt-0.5 border-t border-stone-100">
          <span>Report Ref Range:</span>
          <span className="font-semibold text-stone-700 font-mono">
            {point.refDisplay}
          </span>
        </div>
      </div>
    )
  }
  return null
}

export default function TrendsView({ onOpenAddReport }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summaryData, setSummaryData] = useState(null)
  const [selectedTestName, setSelectedTestName] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch all reports and measurements for authenticated user
  const fetchTrendsData = async () => {
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

  useEffect(() => {
    fetchTrendsData()
  }, [])

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
  // LOADING STATE
  // ----------------------------------------------------
  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3 antialiased">
        <div className="w-9 h-9 border-3 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-stone-500">Preparing biomarker trends...</p>
      </div>
    )
  }

  // ----------------------------------------------------
  // ERROR STATE
  // ----------------------------------------------------
  if (error) {
    return (
      <div className="space-y-4 max-w-xl mx-auto my-12 antialiased">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
          <span className="text-rose-500 font-bold">•</span>
          <div className="space-y-1 flex-1">
            <p className="font-semibold">Unable to load trends</p>
            <p>{error}</p>
          </div>
        </div>
        <button
          onClick={fetchTrendsData}
          className="px-4 py-2 bg-[#5B3FE0] text-white text-xs font-semibold rounded-xl hover:bg-[#4d34c7] transition-all cursor-pointer"
        >
          Try Again
        </button>
      </div>
    )
  }

  // ----------------------------------------------------
  // EMPTY STATE CASE A: NO REPORTS AT ALL
  // ----------------------------------------------------
  if (!summaryData || summaryData.totalReportsCount === 0) {
    return (
      <div className="space-y-6 max-w-4xl antialiased">
        <div className="border-b border-stone-200/80 pb-5">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Trends</h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Track how your measurements change across reports
          </p>
        </div>

        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-12 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-[#5B3FE0]/10 text-[#5B3FE0] text-2xl flex items-center justify-center mx-auto">
            📈
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-stone-900">No report history yet</h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
              Add your first laboratory reports to start observing historical measurement trajectories and changes over time.
            </p>
          </div>
          <button
            onClick={onOpenAddReport}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#5B3FE0] hover:bg-[#4d34c7] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span>+ Add Your First Report</span>
          </button>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // EMPTY STATE CASE B: INSUFFICIENT REPEATED MEASUREMENTS
  // ----------------------------------------------------
  if (!summaryData.hasEligibleTests) {
    return (
      <div className="space-y-6 max-w-4xl antialiased">
        <div className="border-b border-stone-200/80 pb-5">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Trends</h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Track how your measurements change across reports
          </p>
        </div>

        <div className="bg-white border border-stone-200/80 rounded-2xl p-10 text-center space-y-5 max-w-xl mx-auto my-8 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 text-xl flex items-center justify-center mx-auto">
            ⏳
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-stone-900">
              Insufficient Repeated Measurements
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
              Trends require at least 2 numeric measurements with compatible units for the same test. You currently have {summaryData.totalReportsCount} {summaryData.totalReportsCount === 1 ? 'report' : 'reports'}, but none share repeated markers yet.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenAddReport}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#5B3FE0] hover:bg-[#4d34c7] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
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
    <div className="space-y-6 max-w-5xl antialiased">
      {/* 1. Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/80 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">Trends</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#5B3FE0]/10 text-[#5B3FE0] rounded-md">
              Descriptive
            </span>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Track how your measurements change across reports
          </p>
        </div>

        <button
          onClick={onOpenAddReport}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 hover:text-stone-900 text-xs font-semibold rounded-xl shadow-2xs transition-all cursor-pointer"
        >
          <span>+</span>
          <span>Add Report</span>
        </button>
      </div>

      {/* 2. Top Summary Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Tracked Tests */}
        <div className="bg-white border border-stone-200/80 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
            Tracked Tests
          </span>
          <span className="text-2xl font-black text-stone-900 mt-1 block">
            {summaryData.eligibleTests.length}
          </span>
          <span className="text-[10px] text-stone-400">≥ 2 numeric observations</span>
        </div>

        {/* Metric 2: Reports Used */}
        <div className="bg-white border border-stone-200/80 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
            Reports Used
          </span>
          <span className="text-2xl font-black text-stone-900 mt-1 block">
            {summaryData.contributingReportsCount}
          </span>
          <span className="text-[10px] text-stone-400">of {summaryData.totalReportsCount} total reports</span>
        </div>

        {/* Metric 3: Selected Test */}
        <div className="bg-white border border-stone-200/80 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
            Selected Test
          </span>
          <span className="text-base font-bold text-stone-900 mt-1 block truncate" title={currentTest?.testName}>
            {currentTest?.testName || '—'}
          </span>
          <span className="text-[10px] text-[#5B3FE0] font-mono">
            {activeUnitGroup?.unitLabel || 'No unit'}
          </span>
        </div>

        {/* Metric 4: Data Points */}
        <div className="bg-white border border-stone-200/80 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
            Data Points
          </span>
          <span className="text-2xl font-black text-stone-900 mt-1 block">
            {activeUnitGroup?.pointsCount ?? 0}
          </span>
          <span className="text-[10px] text-stone-400">plotted chronologically</span>
        </div>
      </div>

      {/* 3. Test Selector & Search Bar */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Select Measurement to Plot
          </div>
          {summaryData.eligibleTests.length > 5 && (
            <input
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#5B3FE0] w-full sm:w-48"
            />
          )}
        </div>

        {/* Horizontal scrollable pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {filteredTests.map((t) => {
            const isSelected = t.testName === selectedTestName
            return (
              <button
                key={t.testName}
                onClick={() => handleSelectTest(t)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center space-x-2 ${
                  isSelected
                    ? 'bg-[#5B3FE0] text-white shadow-xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200/80'
                }`}
              >
                <span>{t.testName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-200/80 text-stone-500'
                  }`}
                >
                  {t.pointsCount}
                </span>
              </button>
            )
          })}
          {filteredTests.length === 0 && (
            <p className="text-xs text-stone-400 py-1">No matching tests found.</p>
          )}
        </div>
      </div>

      {/* 4. Chart Card with Unit Selector & Mathematical Direction Strip */}
      {currentTest && activeUnitGroup && (
        <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden space-y-4 p-6">
          {/* Chart Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-stone-900">
                  {currentTest.testName}
                </h3>
                {activeUnitGroup.unit && (
                  <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-stone-100 text-stone-600 rounded-md">
                    {activeUnitGroup.unit}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Observed values over time across laboratory reports
              </p>
            </div>

            {/* Unit Selector (if multiple units exist for this test) */}
            {currentTest.unitGroups.length > 1 && (
              <div className="flex items-center space-x-2 bg-stone-50 p-1 rounded-xl border border-stone-200">
                <span className="text-[11px] font-semibold text-stone-500 pl-2">Unit:</span>
                {currentTest.unitGroups.map((g) => (
                  <button
                    key={g.unitLabel}
                    onClick={() => setSelectedUnit(g.unitLabel)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeUnitGroup.unitLabel === g.unitLabel
                        ? 'bg-[#5B3FE0] text-white shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
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
            <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start space-x-2">
              <span className="text-amber-500 font-bold shrink-0">ℹ️</span>
              <p className="leading-relaxed">
                <span className="font-semibold">{excludedInfo.count} {excludedInfo.count === 1 ? 'measurement' : 'measurements'}</span> excluded from this chart because different units were detected ({excludedInfo.units}). Units are never combined onto the same line.
              </p>
            </div>
          )}

          {/* Direction Summary Badges (Section 14) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/70 p-3.5 rounded-xl border border-stone-200/60 text-xs">
            {/* First Value */}
            <div>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                First Recorded
              </span>
              <div className="font-bold text-stone-800 mt-0.5 font-mono">
                {activeUnitGroup.first.value} {activeUnitGroup.unit}
              </div>
              <span className="text-[10px] text-stone-400">
                {activeUnitGroup.first.formattedDate}
              </span>
            </div>

            {/* Latest Value */}
            <div>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                Latest Recorded
              </span>
              <div className="font-bold text-stone-800 mt-0.5 font-mono">
                {activeUnitGroup.latest.value} {activeUnitGroup.unit}
              </div>
              <span className="text-[10px] text-stone-400">
                {activeUnitGroup.latest.formattedDate}
              </span>
            </div>

            {/* Net Delta */}
            <div>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                Net Change (Δ)
              </span>
              <div className="font-black text-stone-900 mt-0.5 font-mono flex items-center space-x-1">
                <span>
                  {activeUnitGroup.netDelta > 0 ? `+${activeUnitGroup.netDelta}` : activeUnitGroup.netDelta}
                </span>
                <span className="text-xs">
                  {activeUnitGroup.direction === 'up' && '↑'}
                  {activeUnitGroup.direction === 'down' && '↓'}
                  {activeUnitGroup.direction === 'neutral' && '='}
                </span>
              </div>
              <span className="text-[10px] text-stone-400">Latest − First</span>
            </div>

            {/* Percentage Change */}
            <div>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                Percentage Change
              </span>
              <div className="font-bold text-stone-800 mt-0.5 font-mono">
                {activeUnitGroup.percentUnavailable
                  ? 'Unavailable (base 0)'
                  : `${activeUnitGroup.percentChange > 0 ? `+${activeUnitGroup.percentChange}` : activeUnitGroup.percentChange}%`}
              </div>
              <span className="text-[10px] text-stone-400">Relative trajectory</span>
            </div>
          </div>

          {/* Recharts Responsive Line Chart */}
          <div className="w-full pt-4 pb-2">
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={activeUnitGroup.points}
                  margin={{ top: 15, right: 25, left: -10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="formattedDate"
                    stroke="#94a3b8"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    domain={yDomain}
                    stroke="#94a3b8"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    dx={-5}
                  />
                  <Tooltip content={<TrendTooltip unit={activeUnitGroup.unit} />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#5B3FE0"
                    strokeWidth={2.5}
                    dot={{
                      r: 5,
                      fill: '#5B3FE0',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 7,
                      fill: '#5B3FE0',
                      stroke: '#c4b5fd',
                      strokeWidth: 3,
                    }}
                    isAnimationActive={true}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. Chronological Data Point History (Section 12) */}
          <div className="border-t border-stone-100 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Measurement Timeline ({activeUnitGroup.points.length})
              </h4>
              <span className="text-[11px] text-stone-400">Chronological history</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeUnitGroup.points.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-3.5 space-y-1.5 transition-all hover:bg-white hover:border-[#5B3FE0]/40 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
                    <span>Point #{idx + 1}</span>
                    <span className="font-bold text-stone-800">{p.formattedDate}</span>
                  </div>
                  <div className="text-base font-extrabold text-stone-900 font-mono">
                    {p.value} <span className="text-xs font-medium text-stone-500">{activeUnitGroup.unit}</span>
                  </div>
                  <div className="text-[11px] text-stone-400 flex items-center justify-between pt-1 border-t border-stone-200/50">
                    <span className="truncate max-w-28" title={p.labName}>{p.labName}</span>
                    <span className="font-mono text-stone-600">Ref: {p.refDisplay}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
