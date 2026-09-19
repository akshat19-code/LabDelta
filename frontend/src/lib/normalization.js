/**
 * Small explicit alias dictionary for common lab test names.
 * Keys are stored in lowercase, values are the canonical normalized name.
 */
const ALIAS_MAP = {
  // Hemoglobin
  hb: 'Hemoglobin',
  hgb: 'Hemoglobin',
  haemoglobin: 'Hemoglobin',
  hemoglobin: 'Hemoglobin',

  // Platelets
  plt: 'Platelets',
  platelets: 'Platelets',
  'platelet count': 'Platelets',

  // Fasting Glucose
  fbs: 'Fasting Glucose',
  'fasting blood sugar': 'Fasting Glucose',
  'fasting glucose': 'Fasting Glucose',
  'fasting blood glucose': 'Fasting Glucose',

  // Basic common markers
  rbc: 'RBC Count',
  wbc: 'WBC Count',
  creatinine: 'Creatinine',
  cholesterol: 'Cholesterol',
  'total cholesterol': 'Total Cholesterol',
}

/**
 * Normalizes a lab test name:
 * 1. Trims whitespace
 * 2. Collapses repeated spaces
 * 3. Compares aliases case-insensitively
 * 4. Maps matching aliases to their canonical name
 * 5. Preserves unknown test names as-is (with trimmed/collapsed whitespace)
 *
 * @param {string} rawName
 * @returns {string}
 */
export function normalizeTestName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return ''
  }

  // 1. Trim and collapse repeated whitespace
  const cleaned = rawName.trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''

  // 2. Lookup in alias map (case-insensitive)
  const lookupKey = cleaned.toLowerCase()
  if (ALIAS_MAP[lookupKey]) {
    return ALIAS_MAP[lookupKey]
  }

  // 3. Preserve unknown test name
  return cleaned
}
