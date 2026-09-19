/**
 * Evaluates whether a numeric value is below, within, or above a report-specific reference range.
 * Does not make clinical judgments; strictly mathematical comparison against stored min/max.
 *
 * @param {number|null} val
 * @param {number|null} min
 * @param {number|null} max
 * @returns {'below'|'within'|'above'|null}
 */
export function evaluateRangeStatus(val, min, max) {
  if (val === null || val === undefined || isNaN(val)) return null
  const num = Number(val)

  if (min !== null && min !== undefined && !isNaN(min) && max !== null && max !== undefined && !isNaN(max)) {
    if (num < Number(min)) return 'below'
    if (num > Number(max)) return 'above'
    return 'within'
  }
  if (min !== null && min !== undefined && !isNaN(min)) {
    if (num < Number(min)) return 'below'
    return 'within'
  }
  if (max !== null && max !== undefined && !isNaN(max)) {
    if (num > Number(max)) return 'above'
    return 'within'
  }
  return null
}

/**
 * Normalizes a unit string for safe compatibility comparison.
 * Trims whitespace and converts to lowercase.
 *
 * @param {string|null} unit
 * @returns {string}
 */
export function normalizeUnit(unit) {
  if (!unit || typeof unit !== 'string') return ''
  return unit.trim().toLowerCase()
}

/**
 * Compares measurements between two distinct lab reports (Previous vs Current).
 * Deterministically groups every observed biomarker into exactly one of:
 * - 'CHANGED'
 * - 'UNCHANGED'
 * - 'NEW'
 * - 'MISSING'
 * - 'UNABLE_TO_COMPARE'
 *
 * @param {Array<object>} prevMeasurements
 * @param {Array<object>} currMeasurements
 * @returns {object} Comparison results and summary metrics
 */
export function compareReports(prevMeasurements = [], currMeasurements = []) {
  // 1. Group measurements by normalized test name (case-insensitive key)
  const prevMap = new Map()
  for (const m of prevMeasurements) {
    const key = (m.test_name_normalized || m.test_name_raw || '').trim().toLowerCase()
    if (!key) continue
    if (!prevMap.has(key)) prevMap.set(key, [])
    prevMap.get(key).push(m)
  }

  const currMap = new Map()
  for (const m of currMeasurements) {
    const key = (m.test_name_normalized || m.test_name_raw || '').trim().toLowerCase()
    if (!key) continue
    if (!currMap.has(key)) currMap.set(key, [])
    currMap.get(key).push(m)
  }

  // 2. Gather all unique test keys across both reports
  const allKeys = new Set([...prevMap.keys(), ...currMap.keys()])

  const results = []
  const summary = {
    total: 0,
    changed: 0,
    unchanged: 0,
    newCount: 0,
    missingCount: 0,
    unableToCompare: 0,
  }

  for (const key of allKeys) {
    const pList = prevMap.get(key) || []
    const cList = currMap.get(key) || []

    const p = pList[0] || null
    const c = cList[0] || null

    const testNameNormalized =
      c?.test_name_normalized || p?.test_name_normalized || c?.test_name_raw || p?.test_name_raw || key

    const testNameRawPrev = p?.test_name_raw || null
    const testNameRawCurr = c?.test_name_raw || null

    const prevDetail = p
      ? {
          valueNumeric: p.value_numeric !== null && p.value_numeric !== undefined ? Number(p.value_numeric) : null,
          valueText: p.value_text || null,
          unit: p.unit || null,
          refMin: p.reference_min !== null && p.reference_min !== undefined ? Number(p.reference_min) : null,
          refMax: p.reference_max !== null && p.reference_max !== undefined ? Number(p.reference_max) : null,
          refText: p.reference_text || null,
          rangeStatus: evaluateRangeStatus(p.value_numeric, p.reference_min, p.reference_max),
        }
      : null

    const currDetail = c
      ? {
          valueNumeric: c.value_numeric !== null && c.value_numeric !== undefined ? Number(c.value_numeric) : null,
          valueText: c.value_text || null,
          unit: c.unit || null,
          refMin: c.reference_min !== null && c.reference_min !== undefined ? Number(c.reference_min) : null,
          refMax: c.reference_max !== null && c.reference_max !== undefined ? Number(c.reference_max) : null,
          refText: c.reference_text || null,
          rangeStatus: evaluateRangeStatus(c.value_numeric, c.reference_min, c.reference_max),
        }
      : null

    let category = 'UNABLE_TO_COMPARE'
    let reason = null
    let delta = null
    let percentChange = null
    let percentUnavailable = false
    let direction = null
    let isTextual = false

    // Condition A: Duplicate entries in either report
    if (pList.length > 1 || cList.length > 1) {
      category = 'UNABLE_TO_COMPARE'
      reason = 'Multiple entries for this test were found in one report.'
      summary.unableToCompare++
    }
    // Condition B: Exists only in Current Report
    else if (pList.length === 0 && cList.length > 0) {
      category = 'NEW'
      summary.newCount++
    }
    // Condition C: Exists only in Previous Report
    else if (pList.length > 0 && cList.length === 0) {
      category = 'MISSING'
      summary.missingCount++
    }
    // Condition D: Present in both reports
    else {
      const pIsNum = prevDetail.valueNumeric !== null
      const cIsNum = currDetail.valueNumeric !== null

      const pIsText = prevDetail.valueText !== null
      const cIsText = currDetail.valueText !== null

      // Both numeric
      if (pIsNum && cIsNum) {
        const uP = normalizeUnit(prevDetail.unit)
        const uC = normalizeUnit(currDetail.unit)

        if (uP !== uC) {
          category = 'UNABLE_TO_COMPARE'
          reason = 'Different units detected — direct comparison unavailable.'
          summary.unableToCompare++
        } else {
          const P = prevDetail.valueNumeric
          const C = currDetail.valueNumeric

          delta = C - P

          if (C === P) {
            category = 'UNCHANGED'
            direction = 'unchanged'
            percentChange = 0
            summary.unchanged++
          } else {
            category = 'CHANGED'
            direction = C > P ? 'up' : 'down'
            if (P === 0) {
              percentChange = null
              percentUnavailable = true
            } else {
              percentChange = ((C - P) / P) * 100
            }
            summary.changed++
          }
        }
      }
      // Both textual
      else if (pIsText && cIsText) {
        isTextual = true
        const textP = prevDetail.valueText.trim().toLowerCase()
        const textC = currDetail.valueText.trim().toLowerCase()

        if (textP === textC) {
          category = 'UNCHANGED'
          direction = 'unchanged'
          summary.unchanged++
        } else {
          category = 'CHANGED'
          summary.changed++
        }
      }
      // Numeric vs Text format mismatch
      else if ((pIsNum && cIsText) || (pIsText && cIsNum)) {
        category = 'UNABLE_TO_COMPARE'
        reason = 'Different result formats — direct comparison unavailable.'
        summary.unableToCompare++
      }
      // Missing values in one or both
      else {
        category = 'UNABLE_TO_COMPARE'
        reason = 'Measurement values are missing or incomplete.'
        summary.unableToCompare++
      }
    }

    results.push({
      testNameNormalized,
      testNameRawPrev,
      testNameRawCurr,
      category,
      reason,
      isTextual,
      prev: prevDetail,
      curr: currDetail,
      delta,
      percentChange,
      percentUnavailable,
      direction,
    })
  }

  summary.total = results.length

  // Sort order: CHANGED first, then NEW, then MISSING, then UNCHANGED, then UNABLE_TO_COMPARE
  const categoryOrder = {
    CHANGED: 1,
    NEW: 2,
    MISSING: 3,
    UNCHANGED: 4,
    UNABLE_TO_COMPARE: 5,
  }

  results.sort((a, b) => {
    const orderDiff = (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99)
    if (orderDiff !== 0) return orderDiff
    return a.testNameNormalized.localeCompare(b.testNameNormalized)
  })

  return {
    summary,
    results,
  }
}
