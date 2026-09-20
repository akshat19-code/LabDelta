/**
 * LabΔ Display Formatting Utilities
 * Deterministic formatting for numeric values, deltas, percentages, and reference ranges.
 * Eliminates IEEE-754 floating point presentation artifacts without modifying underlying data.
 */

/**
 * Formats a measurement value for display.
 * Strips floating-point noise and formats large integers with commas.
 *
 * @param {number|string|null|undefined} val - The value to format
 * @returns {string} Formatted string
 */
export function formatValue(val) {
  if (val === null || val === undefined || val === '') {
    return '—'
  }

  // If already a number
  if (typeof val === 'number') {
    if (isNaN(val)) return '—'
    // Round to at most 2 decimals without floating point junk
    const rounded = Number(Math.round(Number(val + 'e2')) + 'e-2')
    // Format with commas for large numbers while preserving decimals
    return rounded.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      useGrouping: true,
    })
  }

  // If string, check if it's purely numeric
  const trimmed = String(val).trim()
  const num = Number(trimmed)
  if (!isNaN(num) && trimmed !== '') {
    const rounded = Number(Math.round(Number(num + 'e2')) + 'e-2')
    return rounded.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      useGrouping: true,
    })
  }

  // Textual / categorical value (e.g. "Borderline", "Negative")
  return trimmed
}

/**
 * Formats a mathematical delta (Current - Previous) for display.
 * Resolves floating point noise such as -0.3999999999999986 -> -0.4.
 *
 * @param {number|null|undefined} delta - The mathematical delta
 * @returns {string} Formatted delta with explicit sign (e.g. "+1.5", "-0.4", "0")
 */
export function formatDelta(delta) {
  if (delta === null || delta === undefined || isNaN(delta)) {
    return '—'
  }

  const num = Number(delta)
  // Round to at most 2 decimal places cleanly
  const clean = Number(Math.round(Number(num + 'e2')) + 'e-2')

  if (Object.is(clean, -0) || clean === 0) {
    return '0.0'
  }

  const formattedNum = Math.abs(clean).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    useGrouping: true,
  })

  if (clean > 0) {
    return `+${formattedNum}`
  }

  return `-${formattedNum}`
}

/**
 * Formats a percentage change for display.
 *
 * @param {number|null|undefined} pct - The percentage change
 * @returns {string} Formatted percentage (e.g. "+5.2%", "-4.3%", "0.0%")
 */
export function formatPercent(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) {
    return '—'
  }

  const num = Number(pct)
  const clean = Number(Math.round(Number(num + 'e1')) + 'e-1')

  if (Object.is(clean, -0) || clean === 0) {
    return '0.0%'
  }

  const formattedNum = Math.abs(clean).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  if (clean > 0) {
    return `+${formattedNum}%`
  }

  return `-${formattedNum}%`
}

/**
 * Formats a date string into a consistent readable format.
 * e.g. "15 Jan 2026"
 *
 * @param {string} dateStr - Date string (YYYY-MM-DD or ISO)
 * @param {object} [options] - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(dateStr, options) {
  if (!dateStr) return '—'
  try {
    // Append T00:00:00 to prevent timezone drift on YYYY-MM-DD strings
    const dateObj = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`)
    if (isNaN(dateObj.getTime())) return dateStr
    return dateObj.toLocaleDateString('en-US', options || {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Formats a reference range cleanly.
 *
 * @param {number|null} min - Reference min
 * @param {number|null} max - Reference max
 * @param {string|null} text - Reference text
 * @returns {string}
 */
export function formatReferenceRange(min, max, text) {
  const hasMin = min !== null && min !== undefined && min !== ''
  const hasMax = max !== null && max !== undefined && max !== ''

  if (hasMin && hasMax) {
    return `${formatValue(min)} – ${formatValue(max)}`
  }
  if (hasMin) {
    return `≥ ${formatValue(min)}`
  }
  if (hasMax) {
    return `≤ ${formatValue(max)}`
  }
  if (text) {
    return String(text).trim()
  }
  return '—'
}

/**
 * Strips redundant demo indicators from lab name for display presentation
 * without modifying the underlying database record.
 * E.g. "HealthLab (Demo)" -> "HealthLab"
 */
export function cleanLabName(name) {
  if (!name) return 'Lab not specified'
  return name.replace(/\s*\((?:demo|Demo)\)/gi, '').trim() || name
}

