import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { compareReports } from '../lib/comparison'
import { formatValue, formatDelta, formatPercent, formatDate, formatReferenceRange, cleanLabName } from '../lib/formatting'
import { handleSpotlightMouseMove } from '../lib/spotlight'
import { useReportsData } from '../context/ReportsContext'

/**
 * Renders consistent, non-diagnostic reference-range status badge for Compare cards.
 * Reuses identical safe semantics and terminology introduced in Trends.
 */
function renderRangeStatusBadge(status, valueNumeric) {
  if (valueNumeric === null || valueNumeric === undefined) {
    return null
  }

  if (status === 'within') {
    return (
      <span className="inline-flex items-center space-x-1.5 mt-2 text-xs font-semibold text-[#5B3FE0] dark:text-[#8266FA] bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 border border-[#5B3FE0]/25 px-2.5 py-1 rounded-md">
        <span className="w-1.5 h-1.5 rounded-full bg-[#5B3FE0] dark:bg-[#8266FA] shrink-0" />
        <span>Within provided range</span>
      </span>
    )
  }

  if (status === 'below') {
    return (
      <span className="inline-flex items-center space-x-1.5 mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-1 rounded-md">
        <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" fill="currentColor">
          <polygon points="1.5,3 8.5,3 5,7.5" />
        </svg>
        <span>Below provided range</span>
      </span>
    )
  }

  if (status === 'above') {
    return (
      <span className="inline-flex items-center space-x-1.5 mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-1 rounded-md">
        <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" fill="currentColor">
          <polygon points="5,2.5 1.5,7 8.5,7" />
        </svg>
        <span>Above provided range</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center space-x-1.5 mt-2 text-xs font-medium text-stone-500 dark:text-slate-400 bg-stone-100 dark:bg-slate-800/80 border border-stone-200/70 dark:border-slate-700/60 px-2.5 py-1 rounded-md">
      <span className="w-1.5 h-1.5 rounded-full border border-stone-400 dark:border-slate-500 bg-transparent shrink-0" />
      <span>Range unavailable</span>
    </span>
  )
}

export default function CompareView({ initialPrevId, initialCurrId, onOpenAddReport }) {
  const { reports: cachedReports = [], measurements: cachedMeasurements = [], loading: contextLoading = false, isLoaded = false, hasProvider = false } = useReportsData()

  const [reports, setReports] = useState(cachedReports)
  const [loadingReports, setLoadingReports] = useState(contextLoading && !isLoaded && cachedReports.length === 0)

  const [prevReportId, setPrevReportId] = useState(initialPrevId || '')
  const [currReportId, setCurrReportId] = useState(initialCurrId || '')

  const [prevMeasurements, setPrevMeasurements] = useState([])
  const [currMeasurements, setCurrMeasurements] = useState([])
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [comparisonError, setComparisonError] = useState('')

  // Filter chip state: 'ALL' | 'CHANGED' | 'UNCHANGED' | 'NEW_MISSING' | 'UNABLE'
  const [filterCategory, setFilterCategory] = useState('ALL')

  // 1. Sync or fetch reports for selector dropdowns
  const loadReports = async () => {
    if (isLoaded) return
    setLoadingReports(true)
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, report_date, lab_name, source_type, created_at')
        .order('report_date', { ascending: false })

      if (error) throw error
      const repList = data || []
      setReports(repList)

      if (!initialPrevId && !initialCurrId && repList.length >= 2) {
        setPrevReportId(repList[1].id)
        setCurrReportId(repList[0].id)
      } else if (!initialPrevId && repList.length === 1) {
        setPrevReportId(repList[0].id)
      }
    } catch (err) {
      setComparisonError(err.message || 'Failed to load reports list.')
    } finally {
      setLoadingReports(false)
    }
  }

  useEffect(() => {
    if (isLoaded || cachedReports.length > 0) {
      setReports(cachedReports)
      setLoadingReports(false)

      // Default to the two most recent reports if none pre-selected
      if (!initialPrevId && !initialCurrId && cachedReports.length >= 2) {
        setPrevReportId((prev) => prev || cachedReports[1].id)
        setCurrReportId((curr) => curr || cachedReports[0].id)
      } else if (!initialPrevId && cachedReports.length === 1) {
        setPrevReportId((prev) => prev || cachedReports[0].id)
      }
      return
    }

    if (!hasProvider) {
      loadReports()
    }
  }, [cachedReports, isLoaded, initialPrevId, initialCurrId, hasProvider])

  // 2. Fetch or slice measurements for the selected reports
  const fetchMeasurements = async () => {
    setLoadingComparison(true)
    setComparisonError('')
    try {
      const [prevRes, currRes] = await Promise.all([
        supabase
          .from('measurements')
          .select('*')
          .eq('report_id', prevReportId),
        supabase
          .from('measurements')
          .select('*')
          .eq('report_id', currReportId),
      ])

      if (prevRes.error) throw prevRes.error
      if (currRes.error) throw currRes.error

      setPrevMeasurements(prevRes.data || [])
      setCurrMeasurements(currRes.data || [])
    } catch (err) {
      setComparisonError(err.message || 'Failed to load measurements for comparison.')
    } finally {
      setLoadingComparison(false)
    }
  }

  useEffect(() => {
    if (!prevReportId || !currReportId || prevReportId === currReportId) {
      setPrevMeasurements([])
      setCurrMeasurements([])
      setComparisonError('')
      return
    }

    // Reuse in-memory cached measurements if available
    if (isLoaded || cachedMeasurements.length > 0) {
      const prevM = cachedMeasurements.filter((m) => m.report_id === prevReportId)
      const currM = cachedMeasurements.filter((m) => m.report_id === currReportId)
      setPrevMeasurements(prevM)
      setCurrMeasurements(currM)
      setLoadingComparison(false)
      setComparisonError('')
      return
    }

    if (!hasProvider) {
      fetchMeasurements()
    }
  }, [prevReportId, currReportId, cachedMeasurements, isLoaded, hasProvider])

  // 3. Swap control
  const handleSwap = () => {
    const temp = prevReportId
    setPrevReportId(currReportId)
    setCurrReportId(temp)
  }

  // 4. Calculate comparison results
  const comparison = useMemo(() => {
    if (!prevReportId || !currReportId || prevReportId === currReportId) {
      return null
    }
    return compareReports(prevMeasurements, currMeasurements)
  }, [prevMeasurements, currMeasurements, prevReportId, currReportId])

  // Filtered results based on selected tab
  const filteredResults = useMemo(() => {
    if (!comparison) return []
    if (filterCategory === 'ALL') return comparison.results
    if (filterCategory === 'CHANGED') return comparison.results.filter((r) => r.category === 'CHANGED')
    if (filterCategory === 'UNCHANGED') return comparison.results.filter((r) => r.category === 'UNCHANGED')
    if (filterCategory === 'NEW_MISSING')
      return comparison.results.filter((r) => r.category === 'NEW' || r.category === 'MISSING')
    if (filterCategory === 'UNABLE') return comparison.results.filter((r) => r.category === 'UNABLE_TO_COMPARE')
    return comparison.results
  }, [comparison, filterCategory])

  const prevReportMeta = reports.find((r) => r.id === prevReportId)
  const currReportMeta = reports.find((r) => r.id === currReportId)

  return (
    <div className="space-y-6 sm:space-y-8 antialiased">
      {/* Header */}
      <div className="border-b border-stone-200/80 dark:border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-2xl font-black flex items-center justify-center shrink-0">
            ⚖️
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-slate-100">
              Compare Lab Reports
            </h2>
            <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 font-medium mt-1">
              Select baseline and current reports to observe measurement changes (Δ).
            </p>
          </div>
        </div>
      </div>

      {/* Selectors & Swap Control Card */}
      <div 
        onMouseMove={handleSpotlightMouseMove}
        className="spotlight-surface bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 lg:p-7 shadow-xs space-y-4 relative"
      >
        {loadingReports ? (
          <div className="py-8 text-center text-sm text-stone-400 dark:text-slate-500 animate-pulse">
            Loading your reports...
          </div>
        ) : (
          <>
            {/* Desktop Symmetrical 3-Column Layout */}
            <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 lg:gap-6 items-start">
              {/* Previous Report Column */}
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between h-5">
                  <label htmlFor="prev-report-select" className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                    Previous Report
                  </label>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-slate-400">
                    Baseline
                  </span>
                </div>
                <select
                  id="prev-report-select"
                  value={prevReportId}
                  onChange={(e) => setPrevReportId(e.target.value)}
                  className="w-full h-12 px-4 bg-stone-50/80 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-700 rounded-xl text-base font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] focus:border-[#5B3FE0] focus:bg-white dark:focus:bg-slate-900 transition-all"
                >
                  <option value="">Select baseline report...</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.report_date)} — {cleanLabName(r.lab_name)}
                    </option>
                  ))}
                </select>
                <div className="h-6 flex items-center text-xs sm:text-sm text-stone-500 dark:text-slate-400">
                  {prevReportMeta ? (
                    <span className="font-medium truncate">
                      {formatDate(prevReportMeta.report_date)} • {cleanLabName(prevReportMeta.lab_name)}
                    </span>
                  ) : (
                    <span className="text-stone-400 dark:text-slate-500 italic">Select a baseline report</span>
                  )}
                </div>
              </div>

              {/* Center Swap Button */}
              <div className="flex flex-col items-center">
                <div className="h-5" aria-hidden="true" />
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSwap}
                    aria-label="Swap reports"
                    title="Swap reports"
                    disabled={!prevReportId || !currReportId}
                    className="w-12 h-12 rounded-xl border border-stone-200 dark:border-slate-700 hover:border-[#5B3FE0] dark:hover:border-[#5B3FE0] bg-stone-50 dark:bg-slate-800/80 hover:bg-[#5B3FE0]/10 dark:hover:bg-[#5B3FE0]/20 text-stone-700 dark:text-slate-300 hover:text-[#5B3FE0] dark:hover:text-[#8266FA] text-lg font-bold transition-all flex items-center justify-center cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed btn-press"
                  >
                    <span className="inline-block transition-transform duration-300 hover:rotate-180">⇄</span>
                  </button>
                </div>
                <div className="h-6" aria-hidden="true" />
              </div>

              {/* Current Report Column */}
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between h-5">
                  <label htmlFor="curr-report-select" className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                    Current Report
                  </label>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] dark:text-[#8266FA]">
                    Newer
                  </span>
                </div>
                <select
                  id="curr-report-select"
                  value={currReportId}
                  onChange={(e) => setCurrReportId(e.target.value)}
                  className="w-full h-12 px-4 bg-stone-50/80 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-700 rounded-xl text-base font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] focus:border-[#5B3FE0] focus:bg-white dark:focus:bg-slate-900 transition-all"
                >
                  <option value="">Select current report...</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.report_date)} — {cleanLabName(r.lab_name)}
                    </option>
                  ))}
                </select>
                <div className="h-6 flex items-center text-xs sm:text-sm text-stone-500 dark:text-slate-400">
                  {currReportMeta ? (
                    <span className="font-medium truncate">
                      {formatDate(currReportMeta.report_date)} • {cleanLabName(currReportMeta.lab_name)}
                    </span>
                  ) : (
                    <span className="text-stone-400 dark:text-slate-500 italic">Select current report</span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Stacked Layout (Never squeeze side-by-side on phone) */}
            <div className="md:hidden space-y-3.5">
              {/* Previous Report */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="prev-report-select-mobile" className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                    Previous Report
                  </label>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-slate-400">
                    Baseline
                  </span>
                </div>
                <select
                  id="prev-report-select-mobile"
                  value={prevReportId}
                  onChange={(e) => setPrevReportId(e.target.value)}
                  className="w-full h-12 px-3.5 bg-stone-50/80 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-700 rounded-xl text-base font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] focus:border-[#5B3FE0]"
                >
                  <option value="">Select baseline report...</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.report_date)} — {cleanLabName(r.lab_name)}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-stone-500 dark:text-slate-400 min-h-5 flex items-center">
                  {prevReportMeta ? (
                    <span className="truncate">{formatDate(prevReportMeta.report_date)} • {cleanLabName(prevReportMeta.lab_name)}</span>
                  ) : (
                    <span className="text-stone-400 dark:text-slate-500 italic">Select a baseline report</span>
                  )}
                </div>
              </div>

              {/* Mobile Swap Button */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleSwap}
                  aria-label="Swap reports"
                  disabled={!prevReportId || !currReportId}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/80 text-xs font-bold text-stone-700 dark:text-slate-300 hover:text-[#5B3FE0] dark:hover:text-[#8266FA] disabled:opacity-40 btn-press"
                >
                  <span>⇅</span>
                  <span>Swap Reports</span>
                </button>
              </div>

              {/* Current Report */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="curr-report-select-mobile" className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-slate-300">
                    Current Report
                  </label>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] dark:text-[#8266FA]">
                    Newer
                  </span>
                </div>
                <select
                  id="curr-report-select-mobile"
                  value={currReportId}
                  onChange={(e) => setCurrReportId(e.target.value)}
                  className="w-full h-12 px-3.5 bg-stone-50/80 dark:bg-slate-900/90 border border-stone-200 dark:border-slate-700 rounded-xl text-base font-medium text-stone-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0] focus:border-[#5B3FE0]"
                >
                  <option value="">Select current report...</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.report_date)} — {cleanLabName(r.lab_name)}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-stone-500 dark:text-slate-400 min-h-5 flex items-center">
                  {currReportMeta ? (
                    <span className="truncate">{formatDate(currReportMeta.report_date)} • {cleanLabName(currReportMeta.lab_name)}</span>
                  ) : (
                    <span className="text-stone-400 dark:text-slate-500 italic">Select current report</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {comparisonError && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-sm font-medium text-amber-800 dark:text-amber-300 animate-fade-in">
            {comparisonError}
          </div>
        )}
      </div>

      {/* Comparison Results Section */}
      {loadingComparison ? (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-2 animate-shimmer">
                <div className="h-3.5 w-20 bg-stone-200/70 dark:bg-slate-700/60 rounded"></div>
                <div className="h-10 w-16 bg-stone-200/70 dark:bg-slate-700/60 rounded"></div>
                <div className="h-3 w-24 bg-stone-200/50 dark:bg-slate-700/40 rounded"></div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-6 space-y-3 animate-shimmer">
                <div className="h-6 w-44 bg-stone-200/70 dark:bg-slate-700/60 rounded"></div>
                <div className="h-20 w-full bg-stone-100/60 dark:bg-slate-800/50 rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      ) : comparison ? (
        <div className="space-y-6">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-1.5 card-interactive">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
                Total Compared
              </span>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 dark:text-slate-100 font-mono">
                {formatValue(comparison.summary.total ?? comparison.summary.totalCompared ?? comparison.results.length)}
              </div>
              <p className="text-xs sm:text-sm text-stone-400 dark:text-slate-500 font-medium">Total matched tests</p>
            </div>

            <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-1.5 card-interactive">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
                Changed Measurements
              </span>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#5B3FE0] dark:text-[#8266FA] font-mono">
                {formatValue(comparison.summary.changed ?? comparison.summary.changedCount ?? 0)}
              </div>
              <p className="text-xs sm:text-sm text-stone-400 dark:text-slate-500 font-medium">Values with non-zero Δ</p>
            </div>

            <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-1.5 card-interactive">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
                Unchanged Measurements
              </span>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {formatValue(comparison.summary.unchanged ?? comparison.summary.unchangedCount ?? 0)}
              </div>
              <p className="text-xs sm:text-sm text-stone-400 dark:text-slate-500 font-medium">Identical values (Δ 0.0)</p>
            </div>

            <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-1.5 card-interactive">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
                New / Missing
              </span>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-700 dark:text-slate-200 font-mono">
                {formatValue((comparison.summary.newCount || 0) + (comparison.summary.missingCount || 0))}
              </div>
              <p className="text-xs sm:text-sm text-stone-400 dark:text-slate-500 font-medium">
                {comparison.summary.newCount || 0} new, {comparison.summary.missingCount || 0} missing
              </p>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2.5 bg-stone-100 dark:bg-[#0E1524] p-2 rounded-2xl border border-stone-200/70 dark:border-slate-800">
            {[
              { key: 'ALL', label: `All (${comparison.results.length})` },
              { key: 'CHANGED', label: `Changed (${comparison.summary.changed ?? comparison.summary.changedCount ?? 0})` },
              { key: 'UNCHANGED', label: `Unchanged (${comparison.summary.unchanged ?? comparison.summary.unchangedCount ?? 0})` },
              {
                key: 'NEW_MISSING',
                label: `New / Missing (${(comparison.summary.newCount || 0) + (comparison.summary.missingCount || 0)})`,
              },
              { key: 'UNABLE', label: `Unable (${comparison.summary.unableToCompare ?? comparison.summary.unableCount ?? 0})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterCategory(tab.key)}
                className={`px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl transition-all cursor-pointer btn-press ${
                  filterCategory === tab.key
                    ? 'bg-white dark:bg-[#1E293B] text-stone-900 dark:text-slate-100 shadow-xs font-bold scale-[1.02]'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Measurement Delta Rows / Cards with Smooth Crossfade */}
          <div key={filterCategory} className="space-y-4 animate-fade-in">
            {filteredResults.length === 0 ? (
              <div className="relative overflow-hidden bg-white dark:bg-[#131B2E] border border-dashed border-stone-200 dark:border-slate-800 rounded-2xl p-12 text-center text-sm text-stone-400 dark:text-slate-500">
                <div className="absolute -right-3 -bottom-5 text-stone-200/25 dark:text-slate-800/40 text-8xl font-black select-none pointer-events-none">
                  Δ
                </div>
                No laboratory tests match this filter category.
              </div>
            ) : (
              filteredResults.map((item, idx) => (
                <div
                  key={item.testNameNormalized + idx}
                  className={`group bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 lg:p-7 shadow-2xs card-interactive space-y-4 stagger-${idx % 5}`}
                >
                  {/* Row Header: Test Name & Category Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-slate-100">
                        {item.testNameNormalized}
                      </h4>
                      {(item.testNameRawPrev &&
                        item.testNameRawPrev.toLowerCase() !== item.testNameNormalized.toLowerCase()) ||
                      (item.testNameRawCurr &&
                        item.testNameRawCurr.toLowerCase() !== item.testNameNormalized.toLowerCase()) ? (
                        <p className="text-xs sm:text-sm text-stone-400 dark:text-slate-500 font-mono mt-0.5">
                          Raw aliases: {item.testNameRawPrev || '—'} → {item.testNameRawCurr || '—'}
                        </p>
                      ) : null}
                    </div>

                    {/* Category Badges */}
                    <div>
                      {item.category === 'CHANGED' && (
                        <span className="px-3.5 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] dark:text-[#8266FA] rounded-xl">
                          Δ Changed
                        </span>
                      )}
                      {item.category === 'UNCHANGED' && (
                        <span className="px-3.5 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-xl">
                          Unchanged
                        </span>
                      )}
                      {item.category === 'NEW' && (
                        <span className="px-3.5 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-xl">
                          New in Current
                        </span>
                      )}
                      {item.category === 'MISSING' && (
                        <span className="px-3.5 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-xl">
                          Not in Current
                        </span>
                      )}
                      {item.category === 'UNABLE_TO_COMPARE' && (
                        <span className="px-3.5 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 rounded-xl">
                          Unable to Compare
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flow comparison: Previous → Current → Delta (Sequential visual language) */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-center bg-stone-50/70 dark:bg-[#0F172A]/70 p-5 sm:p-6 rounded-2xl border border-stone-200/70 dark:border-slate-800">
                    {/* Previous Column */}
                    <div className="md:col-span-4 space-y-1.5 flow-prev">
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
                        Previous ({prevReportMeta ? formatDate(prevReportMeta.report_date) : 'Baseline'})
                      </span>
                      {item.prev ? (
                        <div
                          className={`rounded-xl transition-all ${
                            item.prev.rangeStatus === 'below' || item.prev.rangeStatus === 'above'
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-2.5 -m-1'
                              : 'p-1 -m-1'
                          }`}
                        >
                          <div>
                            <span className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-slate-100 font-mono">
                              {item.prev.valueNumeric !== null
                                ? formatValue(item.prev.valueNumeric)
                                : item.prev.valueText}
                            </span>
                            {item.prev.unit && (
                              <span className="ml-1.5 text-sm sm:text-base text-stone-500 dark:text-slate-400 font-mono">{item.prev.unit}</span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 font-mono mt-1">
                            Ref: {formatReferenceRange(item.prev.refMin, item.prev.refMax, item.prev.refText)}
                          </div>
                          {renderRangeStatusBadge(item.prev.rangeStatus, item.prev.valueNumeric)}
                        </div>
                      ) : (
                        <span className="text-sm sm:text-base text-stone-400 dark:text-slate-500 italic">Not tested in baseline</span>
                      )}
                    </div>

                    {/* Flow Connector Arrow (responsive: ↓ on mobile, → on desktop) */}
                    <div className="md:col-span-1 flex items-center justify-center py-1 md:py-0 flow-arrow-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-200/70 dark:bg-slate-800 border border-stone-300/80 dark:border-slate-700 text-stone-600 dark:text-slate-300 text-xs sm:text-sm font-bold flex items-center justify-center shadow-2xs">
                        <span className="hidden md:inline leading-none">→</span>
                        <span className="md:hidden leading-none">↓</span>
                      </div>
                    </div>

                    {/* Current Column */}
                    <div className="md:col-span-4 space-y-1.5 flow-curr">
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 block">
                        Current ({currReportMeta ? formatDate(currReportMeta.report_date) : 'Newer'})
                      </span>
                      {item.curr ? (
                        <div
                          className={`rounded-xl transition-all ${
                            item.curr.rangeStatus === 'below' || item.curr.rangeStatus === 'above'
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-2.5 -m-1'
                              : 'p-1 -m-1'
                          }`}
                        >
                          <div>
                            <span className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-slate-100 font-mono">
                              {item.curr.valueNumeric !== null
                                ? formatValue(item.curr.valueNumeric)
                                : item.curr.valueText}
                            </span>
                            {item.curr.unit && (
                              <span className="ml-1.5 text-sm sm:text-base text-stone-500 dark:text-slate-400 font-mono">{item.curr.unit}</span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 font-mono mt-1">
                            Ref: {formatReferenceRange(item.curr.refMin, item.curr.refMax, item.curr.refText)}
                          </div>
                          {renderRangeStatusBadge(item.curr.rangeStatus, item.curr.valueNumeric)}
                        </div>
                      ) : (
                        <span className="text-sm sm:text-base text-stone-400 dark:text-slate-500 italic">Not tested in current report</span>
                      )}
                    </div>

                    {/* Delta Badge Column */}
                    <div className="md:col-span-3 border-t md:border-t-0 md:border-l border-stone-200/80 dark:border-slate-800 pt-3 md:pt-0 md:pl-5 flow-delta rounded-xl transition-all group-hover:bg-[#5B3FE0]/5 dark:group-hover:bg-[#5B3FE0]/10 p-2">
                      {item.category === 'CHANGED' && !item.isTextual && (
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl sm:text-3xl font-black text-[#5B3FE0] dark:text-[#8266FA] font-mono delta-badge">
                              Δ {formatDelta(item.delta)}
                            </span>
                            {item.direction === 'up' && (
                              <span className="text-lg font-bold text-stone-800 dark:text-slate-200 inline-block animate-arrow-up">↑</span>
                            )}
                            {item.direction === 'down' && (
                              <span className="text-lg font-bold text-stone-800 dark:text-slate-200 inline-block animate-arrow-down">↓</span>
                            )}
                          </div>
                          <div className="text-sm sm:text-base font-bold text-stone-700 dark:text-slate-300 font-mono">
                            {item.percentUnavailable ? (
                              <span className="text-xs text-stone-400 dark:text-slate-500 font-normal">
                                Percentage change unavailable
                              </span>
                            ) : (
                              <span>
                                {item.direction === 'up' ? '↑' : '↓'} {formatPercent(Math.abs(item.percentChange))}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {item.category === 'CHANGED' && item.isTextual && (
                        <div className="text-sm font-medium text-stone-700 dark:text-slate-300 space-y-0.5">
                          <span className="text-xs uppercase font-bold text-stone-400 dark:text-slate-500 block">Textual Change</span>
                          <span className="font-semibold">{item.prev?.valueText} → {item.curr?.valueText}</span>
                        </div>
                      )}

                      {item.category === 'UNCHANGED' && (
                        <div className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-300 font-mono">
                          Δ 0.0 (No change)
                        </div>
                      )}

                      {item.category === 'NEW' && (
                        <div className="text-sm sm:text-base font-semibold text-emerald-700 dark:text-emerald-300">
                          New measurement added
                        </div>
                      )}

                      {item.category === 'MISSING' && (
                        <div className="text-sm sm:text-base font-semibold text-amber-700 dark:text-amber-300">
                          Not tested in current
                        </div>
                      )}

                      {item.category === 'UNABLE_TO_COMPARE' && (
                        <div className="text-sm text-stone-600 dark:text-slate-400 leading-snug">
                          {item.reason || 'Direct comparison unavailable.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : !loadingComparison ? (
        /* Restrained Compare Empty State when comparison cannot run */
        <div className="bg-white dark:bg-[#131B2E] border border-stone-200/90 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xs animate-fade-in max-w-xl mx-auto my-4">
          <div className="w-14 h-14 rounded-2xl bg-[#5B3FE0]/10 dark:bg-[#5B3FE0]/20 text-[#5B3FE0] text-3xl font-black flex items-center justify-center mx-auto select-none delta-badge">
            Δ
          </div>
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-slate-100 tracking-tight">
              {reports.length < 2
                ? 'Add another report to start comparing'
                : 'Select two reports to see what changed.'}
            </h3>
            <p className="text-sm sm:text-base text-stone-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {reports.length < 2
                ? 'You need at least two lab reports to compute a baseline comparison and calculate measurement deltas.'
                : 'LabΔ will match measurements across both reports and calculate their changes.'}
            </p>
          </div>
          {reports.length < 2 && onOpenAddReport && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenAddReport}
                className="px-5 py-3 btn-primary text-sm sm:text-base font-semibold shadow-xs inline-flex items-center space-x-2 cursor-pointer"
              >
                <span>+ Add Report</span>
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
