import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { compareReports } from '../lib/comparison'

export default function CompareView({ initialPrevId, initialCurrId, onOpenAddReport }) {
  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)

  const [prevReportId, setPrevReportId] = useState(initialPrevId || '')
  const [currReportId, setCurrReportId] = useState(initialCurrId || '')

  const [prevMeasurements, setPrevMeasurements] = useState([])
  const [currMeasurements, setCurrMeasurements] = useState([])
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [comparisonError, setComparisonError] = useState('')

  // Filter chip state: 'ALL' | 'CHANGED' | 'UNCHANGED' | 'NEW_MISSING' | 'UNABLE'
  const [filterCategory, setFilterCategory] = useState('ALL')

  // 1. Fetch all user reports for selector dropdowns
  useEffect(() => {
    async function loadReports() {
      setLoadingReports(true)
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('id, report_date, lab_name, source_type, created_at')
          .order('report_date', { ascending: false })

        if (error) throw error
        const repList = data || []
        setReports(repList)

        // Default selection if available: prev = 2nd newest, curr = 1st newest
        if (!prevReportId && !currReportId && repList.length >= 2) {
          setCurrReportId(repList[0].id)
          setPrevReportId(repList[1].id)
        } else if (!currReportId && repList.length >= 1) {
          setCurrReportId(repList[0].id)
        }
      } catch (err) {
        setComparisonError(err.message || 'Failed to load reports for comparison.')
      } finally {
        setLoadingReports(false)
      }
    }

    loadReports()
  }, [])

  // 2. Fetch measurements whenever prevReportId or currReportId changes
  useEffect(() => {
    async function fetchMeasurements() {
      if (!prevReportId || !currReportId) {
        setPrevMeasurements([])
        setCurrMeasurements([])
        return
      }

      if (prevReportId === currReportId) {
        setComparisonError('Please select two different reports to compare.')
        setPrevMeasurements([])
        setCurrMeasurements([])
        return
      }

      setLoadingComparison(true)
      setComparisonError('')

      try {
        const [prevRes, currRes] = await Promise.all([
          supabase.from('measurements').select('*').eq('report_id', prevReportId),
          supabase.from('measurements').select('*').eq('report_id', currReportId),
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

    fetchMeasurements()
  }, [prevReportId, currReportId])

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
    <div className="space-y-8 max-w-5xl antialiased">
      {/* Header */}
      <div className="border-b border-stone-200/80 pb-5">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-[#5B3FE0]/10 text-[#5B3FE0] text-lg font-black flex items-center justify-center">
            Δ
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">
              Compare Lab Reports
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Choose two reports to see exactly what changed.
            </p>
          </div>
        </div>
      </div>

      {/* Selectors & Swap Control Card */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        {loadingReports ? (
          <div className="py-6 text-center text-xs text-stone-400">Loading your reports...</div>
        ) : reports.length < 2 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm font-medium text-stone-700">
              You need at least two lab reports to compute a comparison.
            </p>
            <button
              onClick={onOpenAddReport}
              className="px-4 py-2 bg-[#5B3FE0] text-white text-xs font-semibold rounded-xl shadow-xs hover:bg-[#4d34c7] cursor-pointer"
            >
              + Add a Report
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
            {/* Previous Report Selector */}
            <div className="md:col-span-5 space-y-1.5 text-left">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500">
                1. Previous Report (Baseline)
              </label>
              <select
                value={prevReportId}
                onChange={(e) => setPrevReportId(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50/70 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0]"
              >
                <option value="">Select baseline report...</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.report_date).toLocaleDateString()} — {r.lab_name || 'Lab not specified'} ({r.source_type})
                  </option>
                ))}
              </select>
              {prevReportMeta && (
                <div className="text-[11px] text-stone-400 font-mono">
                  Collected on {new Date(prevReportMeta.report_date).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Swap Button / Arrow */}
            <div className="md:col-span-1 flex items-center justify-center pt-4 md:pt-0">
              <button
                type="button"
                onClick={handleSwap}
                title="Swap Previous and Current Reports"
                disabled={!prevReportId || !currReportId}
                className="w-10 h-10 rounded-full border border-stone-200 hover:border-[#5B3FE0] bg-stone-50 hover:bg-[#5B3FE0]/10 text-stone-600 hover:text-[#5B3FE0] text-base font-bold transition-all flex items-center justify-center cursor-pointer shadow-2xs disabled:opacity-40"
              >
                ⇄
              </button>
            </div>

            {/* Current Report Selector */}
            <div className="md:col-span-5 space-y-1.5 text-left">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500">
                2. Current Report (Newer)
              </label>
              <select
                value={currReportId}
                onChange={(e) => setCurrReportId(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50/70 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5B3FE0]/30 focus:border-[#5B3FE0]"
              >
                <option value="">Select comparison report...</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.report_date).toLocaleDateString()} — {r.lab_name || 'Lab not specified'} ({r.source_type})
                  </option>
                ))}
              </select>
              {currReportMeta && (
                <div className="text-[11px] text-stone-400 font-mono">
                  Collected on {new Date(currReportMeta.report_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

        {comparisonError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {comparisonError}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {loadingComparison ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#5B3FE0] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium text-stone-500">Computing biomarker deltas...</p>
        </div>
      ) : comparison ? (
        <div className="space-y-6">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                Total Compared
              </span>
              <span className="text-2xl font-black text-stone-900 font-mono">
                {comparison.summary.total}
              </span>
            </div>

            <div className="bg-white border border-[#5B3FE0]/30 rounded-xl p-3.5 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B3FE0] block">
                Changed (Δ)
              </span>
              <span className="text-2xl font-black text-[#5B3FE0] font-mono">
                {comparison.summary.changed}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                Unchanged
              </span>
              <span className="text-2xl font-black text-blue-600 font-mono">
                {comparison.summary.unchanged}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
                New / Missing
              </span>
              <span className="text-2xl font-black text-amber-600 font-mono">
                {comparison.summary.newCount + comparison.summary.missingCount}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-center shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Unable to Compare
              </span>
              <span className="text-2xl font-black text-stone-600 font-mono">
                {comparison.summary.unableToCompare}
              </span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200/70 w-fit">
            {[
              { key: 'ALL', label: `All (${comparison.summary.total})` },
              { key: 'CHANGED', label: `Changed (${comparison.summary.changed})` },
              { key: 'UNCHANGED', label: `Unchanged (${comparison.summary.unchanged})` },
              {
                key: 'NEW_MISSING',
                label: `New & Missing (${comparison.summary.newCount + comparison.summary.missingCount})`,
              },
              { key: 'UNABLE', label: `Unable (${comparison.summary.unableToCompare})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterCategory(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filterCategory === tab.key
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Biomarker Delta Rows / Cards */}
          <div className="space-y-3">
            {filteredResults.length === 0 ? (
              <div className="bg-white border border-dashed border-stone-200 rounded-xl p-8 text-center text-xs text-stone-400">
                No tests match this filter category.
              </div>
            ) : (
              filteredResults.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
                >
                  {/* Row Header: Test Name & Category Badge */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-bold text-stone-900">
                        {item.testNameNormalized}
                      </h4>
                      {(item.testNameRawPrev &&
                        item.testNameRawPrev.toLowerCase() !== item.testNameNormalized.toLowerCase()) ||
                      (item.testNameRawCurr &&
                        item.testNameRawCurr.toLowerCase() !== item.testNameNormalized.toLowerCase()) ? (
                        <p className="text-[11px] text-stone-400 font-mono">
                          Raw aliases: {item.testNameRawPrev || '—'} → {item.testNameRawCurr || '—'}
                        </p>
                      ) : null}
                    </div>

                    {/* Category Badges */}
                    <div>
                      {item.category === 'CHANGED' && (
                        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-[#5B3FE0]/10 text-[#5B3FE0] rounded-lg">
                          Δ Changed
                        </span>
                      )}
                      {item.category === 'UNCHANGED' && (
                        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 rounded-lg">
                          Unchanged
                        </span>
                      )}
                      {item.category === 'NEW' && (
                        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-lg">
                          New in Current
                        </span>
                      )}
                      {item.category === 'MISSING' && (
                        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 rounded-lg">
                          Not in Current
                        </span>
                      )}
                      {item.category === 'UNABLE_TO_COMPARE' && (
                        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 rounded-lg">
                          Unable to Compare
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flow comparison: Previous → Current → Delta */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-stone-50/70 p-4 rounded-xl border border-stone-200/70">
                    {/* Previous Column */}
                    <div className="md:col-span-4 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Previous ({prevReportMeta ? new Date(prevReportMeta.report_date).toLocaleDateString() : 'Baseline'})
                      </span>
                      {item.prev ? (
                        <div>
                          <span className="text-base font-extrabold text-stone-900 font-mono">
                            {item.prev.valueNumeric !== null ? item.prev.valueNumeric : item.prev.valueText}
                          </span>
                          {item.prev.unit && (
                            <span className="ml-1 text-xs text-stone-500 font-mono">{item.prev.unit}</span>
                          )}
                          <div className="text-[11px] text-stone-400 font-mono">
                            Ref:{' '}
                            {item.prev.refMin !== null && item.prev.refMax !== null
                              ? `${item.prev.refMin} – ${item.prev.refMax}`
                              : item.prev.refText || '—'}
                          </div>
                          {item.prev.rangeStatus && (
                            <span className="inline-block mt-0.5 text-[10px] font-medium text-stone-500 bg-stone-200/60 px-1.5 py-0.2 rounded">
                              {item.prev.rangeStatus === 'within'
                                ? 'Within range'
                                : item.prev.rangeStatus === 'below'
                                ? 'Below range'
                                : 'Above range'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">Not tested in baseline</span>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="md:col-span-1 text-center text-stone-400 text-lg font-bold">
                      →
                    </div>

                    {/* Current Column */}
                    <div className="md:col-span-4 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Current ({currReportMeta ? new Date(currReportMeta.report_date).toLocaleDateString() : 'Newer'})
                      </span>
                      {item.curr ? (
                        <div>
                          <span className="text-base font-extrabold text-stone-900 font-mono">
                            {item.curr.valueNumeric !== null ? item.curr.valueNumeric : item.curr.valueText}
                          </span>
                          {item.curr.unit && (
                            <span className="ml-1 text-xs text-stone-500 font-mono">{item.curr.unit}</span>
                          )}
                          <div className="text-[11px] text-stone-400 font-mono">
                            Ref:{' '}
                            {item.curr.refMin !== null && item.curr.refMax !== null
                              ? `${item.curr.refMin} – ${item.curr.refMax}`
                              : item.curr.refText || '—'}
                          </div>
                          {item.curr.rangeStatus && (
                            <span className="inline-block mt-0.5 text-[10px] font-medium text-stone-500 bg-stone-200/60 px-1.5 py-0.2 rounded">
                              {item.curr.rangeStatus === 'within'
                                ? 'Within range'
                                : item.curr.rangeStatus === 'below'
                                ? 'Below range'
                                : 'Above range'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">Not tested in current report</span>
                      )}
                    </div>

                    {/* Delta Badge Column */}
                    <div className="md:col-span-3 border-t md:border-t-0 md:border-l border-stone-200/80 pt-3 md:pt-0 md:pl-4">
                      {item.category === 'CHANGED' && !item.isTextual && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-sm font-black text-[#5B3FE0] font-mono">
                              Δ {item.delta > 0 ? `+${item.delta}` : item.delta}
                            </span>
                            {item.direction === 'up' && <span className="text-xs font-bold text-stone-700">↑</span>}
                            {item.direction === 'down' && <span className="text-xs font-bold text-stone-700">↓</span>}
                          </div>
                          <div className="text-xs font-semibold text-stone-600 font-mono">
                            {item.percentUnavailable ? (
                              <span className="text-[10px] text-stone-400 font-normal">
                                Percentage change unavailable
                              </span>
                            ) : (
                              <span>
                                {item.direction === 'up' ? '↑' : '↓'}{' '}
                                {Math.abs(item.percentChange).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {item.category === 'CHANGED' && item.isTextual && (
                        <div className="text-xs font-medium text-stone-700">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block">Textual Change</span>
                          <span>{item.prev?.valueText} → {item.curr?.valueText}</span>
                        </div>
                      )}

                      {item.category === 'UNCHANGED' && (
                        <div className="text-xs font-semibold text-blue-700 font-mono">
                          Δ 0.0 (No change)
                        </div>
                      )}

                      {item.category === 'NEW' && (
                        <div className="text-xs font-medium text-emerald-700">
                          New marker added
                        </div>
                      )}

                      {item.category === 'MISSING' && (
                        <div className="text-xs font-medium text-amber-700">
                          Not tested in current
                        </div>
                      )}

                      {item.category === 'UNABLE_TO_COMPARE' && (
                        <div className="text-[11px] text-stone-500 leading-snug">
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
      ) : null}
    </div>
  )
}
