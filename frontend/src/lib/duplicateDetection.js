import { normalizeTestName } from './normalization.js'

/**
 * Normalizes lab name for case-insensitive, whitespace-collapsed comparison.
 * Empty or whitespace-only strings are treated as empty string.
 */
export function normalizeLabName(name) {
  if (!name || typeof name !== 'string') return ''
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Compares incoming measurements with existing measurements for a candidate report.
 * Returns true ONLY when:
 * 1. Both have the exact same number of measurements.
 * 2. Every incoming measurement finds an exact, unused corresponding measurement in existing:
 *    - normalized test name matches
 *    - unit matches (whitespace-normalized, case-insensitive)
 *    - value matches (exact numeric or exact text/categorical)
 *
 * @param {Array} incomingRows - Array of { testName, value, unit, ... }
 * @param {Array} existingMeasurements - Array of { test_name_normalized, value_numeric, value_text, unit, ... }
 * @returns {boolean}
 */
export function isExactDuplicateMeasurements(incomingRows, existingMeasurements) {
  if (!Array.isArray(incomingRows) || !Array.isArray(existingMeasurements)) {
    return false
  }
  if (incomingRows.length !== existingMeasurements.length) {
    return false
  }

  // Parse incoming rows into comparable format
  const incomingParsed = incomingRows.map((row) => {
    const rawName = (row.testName || '').trim()
    const normalized = normalizeTestName(rawName)

    const rawVal = (row.value || '').trim()
    const numVal = parseFloat(rawVal)
    const isNumeric = !isNaN(numVal) && isFinite(rawVal)

    const unitNorm = (row.unit || '').trim().replace(/\s+/g, ' ').toLowerCase()

    return {
      test_name_normalized: normalized,
      is_numeric: isNumeric,
      value_numeric: isNumeric ? numVal : null,
      value_text: isNumeric ? null : rawVal.trim(),
      unit: unitNorm,
    }
  })

  // Clone existing measurements to track 1-to-1 matching
  const remainingExisting = [...existingMeasurements]

  for (const inc of incomingParsed) {
    const matchIndex = remainingExisting.findIndex((ext) => {
      // 1. Normalized test name must match
      if (inc.test_name_normalized !== ext.test_name_normalized) {
        return false
      }

      // 2. Unit must match (case-insensitive, whitespace-normalized)
      const extUnit = (ext.unit || '').trim().replace(/\s+/g, ' ').toLowerCase()
      if (inc.unit !== extUnit) {
        return false
      }

      // 3. Values must match
      if (inc.is_numeric) {
        if (ext.value_numeric === null || ext.value_numeric === undefined) {
          return false
        }
        // Exact numeric match
        return inc.value_numeric === Number(ext.value_numeric)
      } else {
        if (ext.value_text === null || ext.value_text === undefined) {
          return false
        }
        // Exact text/categorical match (whitespace-collapsed, case-insensitive)
        const incText = (inc.value_text || '').replace(/\s+/g, ' ').toLowerCase()
        const extText = ext.value_text.trim().replace(/\s+/g, ' ').toLowerCase()
        return incText === extText
      }
    })

    if (matchIndex === -1) {
      return false
    }

    // Remove the matched element so it cannot be matched twice
    remainingExisting.splice(matchIndex, 1)
  }

  return remainingExisting.length === 0
}

/**
 * Checks whether an incoming report is an exact duplicate of an existing report
 * for the authenticated user.
 *
 * @param {object} params
 * @param {object} params.supabase - Supabase client instance
 * @param {string} params.userId - Authenticated user UUID
 * @param {string} params.reportDate - 'YYYY-MM-DD'
 * @param {string} params.labName - Raw lab name
 * @param {Array} params.validRows - Array of { testName, value, unit, ... }
 * @returns {Promise<{ isDuplicate: boolean, duplicateReport: object|null }>}
 */
export async function checkForDuplicateReport({ supabase, userId, reportDate, labName, validRows }) {
  if (!supabase || !userId || !reportDate || !validRows || validRows.length === 0) {
    return { isDuplicate: false, duplicateReport: null }
  }

  try {
    // 1. Query reports for the same user and same report_date
    const { data: candidateReports, error: repError } = await supabase
      .from('reports')
      .select('id, report_date, lab_name')
      .eq('user_id', userId)
      .eq('report_date', reportDate)

    if (repError || !candidateReports || candidateReports.length === 0) {
      return { isDuplicate: false, duplicateReport: null }
    }

    // 2. Filter candidates by matching lab name (case-insensitive, whitespace-normalized)
    const incomingLabNorm = normalizeLabName(labName)
    const matchingLabReports = candidateReports.filter(
      (r) => normalizeLabName(r.lab_name) === incomingLabNorm
    )

    if (matchingLabReports.length === 0) {
      return { isDuplicate: false, duplicateReport: null }
    }

    // 3. Query measurements for matching candidate reports
    const candidateIds = matchingLabReports.map((r) => r.id)
    const { data: measurements, error: measError } = await supabase
      .from('measurements')
      .select('id, report_id, test_name_normalized, value_numeric, value_text, unit')
      .in('report_id', candidateIds)

    if (measError || !measurements || measurements.length === 0) {
      return { isDuplicate: false, duplicateReport: null }
    }

    // Group measurements by report_id
    const measurementsByReport = {}
    for (const m of measurements) {
      if (!measurementsByReport[m.report_id]) {
        measurementsByReport[m.report_id] = []
      }
      measurementsByReport[m.report_id].push(m)
    }

    // 4. Test each candidate report for exact duplicate measurements
    for (const report of matchingLabReports) {
      const existingMeas = measurementsByReport[report.id] || []
      if (isExactDuplicateMeasurements(validRows, existingMeas)) {
        return { isDuplicate: true, duplicateReport: report }
      }
    }

    return { isDuplicate: false, duplicateReport: null }
  } catch (err) {
    // Graceful fallback: fail open so unexpected errors don't prevent saving
    return { isDuplicate: false, duplicateReport: null }
  }
}
