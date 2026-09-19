/**
 * LabΔ (LabDelta) - Trends Processing Engine
 * Pure deterministic data processing for chronological laboratory test trends.
 * Strictly descriptive and mathematical. No clinical interpretations or predictions.
 */

/**
 * Format an ISO date string (YYYY-MM-DD) into a human-readable format.
 * E.g. "2026-01-15" -> "15 Jan 2026"
 */
export function formatTrendDate(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format reference range for display on a tooltip or card.
 */
export function formatPointReference(m) {
  if (m.reference_min !== null && m.reference_min !== undefined && m.reference_max !== null && m.reference_max !== undefined) {
    return `${m.reference_min} – ${m.reference_max}`
  }
  if (m.reference_min !== null && m.reference_min !== undefined) {
    return `≥ ${m.reference_min}`
  }
  if (m.reference_max !== null && m.reference_max !== undefined) {
    return `≤ ${m.reference_max}`
  }
  if (m.reference_text) {
    return m.reference_text
  }
  return 'Not specified'
}

/**
 * Builds the complete trends summary from user reports and measurements.
 * 
 * @param {Array} reports - List of report records { id, report_date, lab_name, created_at }
 * @param {Array} measurements - List of measurement records
 * @returns {Object} Trends summary metadata and test groupings
 */
export function buildTrendsSummary(reports = [], measurements = []) {
  // 1. Index reports by ID
  const reportMap = new Map()
  for (const r of reports) {
    reportMap.set(r.id, r)
  }

  // 2. Group measurements by normalized test name
  const testsMap = new Map()

  for (const m of measurements) {
    const report = reportMap.get(m.report_id)
    if (!report) continue // Skip orphaned measurements

    const testName = m.test_name_normalized?.trim() || m.test_name_raw?.trim() || 'Unknown Test'
    if (!testsMap.has(testName)) {
      testsMap.set(testName, {
        testName,
        numericRows: [],
        textualRows: [],
      })
    }

    const testEntry = testsMap.get(testName)
    const isNumeric = m.value_numeric !== null && m.value_numeric !== undefined && !isNaN(Number(m.value_numeric))

    const point = {
      id: m.id,
      reportId: report.id,
      reportDate: report.report_date,
      createdAt: report.created_at,
      formattedDate: formatTrendDate(report.report_date),
      labName: report.lab_name || 'Lab not specified',
      valueNumeric: isNumeric ? Number(m.value_numeric) : null,
      valueText: m.value_text || (isNumeric ? null : String(m.value_numeric ?? '')),
      unit: (m.unit || '').trim(),
      rawName: m.test_name_raw || testName,
      refMin: m.reference_min,
      refMax: m.reference_max,
      refText: m.reference_text,
      refDisplay: formatPointReference(m),
    }

    if (isNumeric) {
      testEntry.numericRows.push(point)
    } else {
      testEntry.textualRows.push(point)
    }
  }

  // 3. Process each test for unit groups and mathematical trajectories
  const eligibleTests = []
  const ineligibleTests = []
  const contributingReportIds = new Set()

  for (const [testName, data] of testsMap.entries()) {
    // Group numeric rows by unit
    const unitGroupsMap = new Map()

    for (const row of data.numericRows) {
      const uKey = row.unit || 'No unit'
      if (!unitGroupsMap.has(uKey)) {
        unitGroupsMap.set(uKey, [])
      }
      unitGroupsMap.get(uKey).push(row)
    }

    // Process each unit group
    const unitGroups = []
    for (const [unit, rows] of unitGroupsMap.entries()) {
      // Sort chronologically by report_date ascending, secondary by created_at
      const sortedRows = [...rows].sort((a, b) => {
        const dateA = new Date(a.reportDate).getTime()
        const dateB = new Date(b.reportDate).getTime()
        if (dateA !== dateB) return dateA - dateB
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })

      // If multiple points exist for the same test on the same report date, keep chronological points
      const points = sortedRows.map((r) => ({
        ...r,
        value: r.valueNumeric,
      }))

      // Mathematical delta calculations
      const first = points[0]
      const latest = points[points.length - 1]
      const netDelta = Number((latest.value - first.value).toFixed(2))

      let percentChange = null
      let percentUnavailable = false

      if (first.value === 0) {
        percentUnavailable = true
      } else {
        percentChange = Number((((latest.value - first.value) / Math.abs(first.value)) * 100).toFixed(1))
      }

      let direction = 'neutral'
      if (netDelta > 0) direction = 'up'
      else if (netDelta < 0) direction = 'down'

      unitGroups.push({
        unit: unit === 'No unit' ? '' : unit,
        unitLabel: unit,
        pointsCount: points.length,
        points,
        first,
        latest,
        netDelta,
        percentChange,
        percentUnavailable,
        direction,
      })
    }

    // Sort unit groups by pointsCount descending (most populated unit first)
    unitGroups.sort((a, b) => b.pointsCount - a.pointsCount)

    // A test is eligible if at least one unit group has >= 2 data points
    const eligibleGroup = unitGroups.find((g) => g.pointsCount >= 2)

    if (eligibleGroup) {
      // Calculate total excluded points due to unit mismatch (for default primary unit)
      const primaryUnit = eligibleGroup.unitLabel
      const excludedPoints = data.numericRows.filter((r) => (r.unit || 'No unit') !== primaryUnit)

      // Collect reports contributing to this eligible test
      for (const p of eligibleGroup.points) {
        contributingReportIds.add(p.reportId)
      }

      eligibleTests.push({
        testName,
        unitGroups,
        defaultUnit: primaryUnit,
        pointsCount: eligibleGroup.pointsCount,
        primaryGroup: eligibleGroup,
        hasUnitMismatch: unitGroups.length > 1,
        excludedPointsCount: excludedPoints.length,
        excludedUnits: unitGroups.filter((g) => g.unitLabel !== primaryUnit).map((g) => g.unitLabel),
        textualCount: data.textualRows.length,
      })
    } else {
      ineligibleTests.push({
        testName,
        pointsCount: data.numericRows.length,
        textualCount: data.textualRows.length,
        reason: data.numericRows.length === 1 ? 'Only 1 measurement recorded' : 'Textual measurements only',
      })
    }
  }

  // Sort eligible tests alphabetically
  eligibleTests.sort((a, b) => a.testName.localeCompare(b.testName))

  return {
    totalReportsCount: reports.length,
    contributingReportsCount: contributingReportIds.size,
    eligibleTests,
    ineligibleTests,
    hasEligibleTests: eligibleTests.length > 0,
  }
}

/**
 * Computes padded domain for Recharts YAxis so small variations are visually readable
 * without flat-lining or forcing to zero.
 */
export function computeYAxisDomain(points = []) {
  if (!points || points.length === 0) return [0, 100]

  const values = points.map((p) => p.value).filter((v) => typeof v === 'number' && !isNaN(v))
  if (values.length === 0) return [0, 100]

  const min = Math.min(...values)
  const max = Math.max(...values)
  const diff = max - min

  if (diff === 0) {
    // Constant line: pad by 10% or +/- 1 unit
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1
    const lower = Math.max(0, Number((min - pad).toFixed(2)))
    const upper = Number((max + pad).toFixed(2))
    return [lower, upper]
  }

  // Use 15% padding above and below data range
  const pad = diff * 0.15
  const lower = Math.max(0, Number((min - pad).toFixed(2)))
  const upper = Number((max + pad).toFixed(2))

  return [lower, upper]
}
