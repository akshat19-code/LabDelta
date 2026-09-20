import { isExactDuplicateMeasurements, normalizeLabName } from '../frontend/src/lib/duplicateDetection.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`)
    passed++
  } else {
    console.error(`[FAIL] ${message}`)
    failed++
  }
}

console.log('=== Duplicate Report Detection Unit Tests ===\n')

// 1. Lab Name Normalization
assert(normalizeLabName('Quest Diagnostics') === 'quest diagnostics', 'Normalizes mixed case')
assert(normalizeLabName('  Quest   Diagnostics  ') === 'quest diagnostics', 'Normalizes extra whitespace')
assert(normalizeLabName('') === '', 'Empty string returns empty')
assert(normalizeLabName(null) === '', 'Null returns empty')
assert(normalizeLabName(undefined) === '', 'Undefined returns empty')
assert(normalizeLabName('City Labs') === normalizeLabName(' city  labs '), 'Matches regardless of casing and spacing')

// 2. Exact Duplicate with Alias Normalization
const existing1 = [
  { test_name_normalized: 'Hemoglobin', value_numeric: 13.8, value_text: null, unit: 'g/dl' },
  { test_name_normalized: 'WBC Count', value_numeric: 7300, value_text: null, unit: '/µl' },
  { test_name_normalized: 'Vitamin D', value_numeric: 21, value_text: null, unit: 'ng/ml' },
]

const incomingDuplicate = [
  { testName: 'HGB', value: '13.8', unit: 'g/dL' }, // HGB normalizes to Hemoglobin
  { testName: 'WBC', value: '7300', unit: '/µL' },  // WBC normalizes to WBC Count
  { testName: 'Vitamin D', value: '21', unit: 'ng/mL' },
]

assert(
  isExactDuplicateMeasurements(incomingDuplicate, existing1),
  'Duplicate detected with alias normalization (HGB -> Hemoglobin, WBC -> WBC Count)'
)

// 3. Different Measurement Count (Adding TSH)
const incomingWithExtra = [
  { testName: 'Hemoglobin', value: '13.8', unit: 'g/dL' },
  { testName: 'WBC Count', value: '7300', unit: '/µL' },
  { testName: 'TSH', value: '3.2', unit: 'µIU/mL' },
]
assert(
  !isExactDuplicateMeasurements(incomingWithExtra, existing1),
  'NOT duplicate when measurement count or set differs'
)

// 4. Same Tests, One Value Differs
const incomingDifferentValue = [
  { testName: 'Hemoglobin', value: '14.0', unit: 'g/dL' }, // 14.0 != 13.8
  { testName: 'WBC Count', value: '7300', unit: '/µL' },
  { testName: 'Vitamin D', value: '21', unit: 'ng/mL' },
]
assert(
  !isExactDuplicateMeasurements(incomingDifferentValue, existing1),
  'NOT duplicate when single value differs'
)

// 5. Same Lab & Date, Completely Different Tests
const incomingDifferentTests = [
  { testName: 'Fasting Glucose', value: '95', unit: 'mg/dL' },
  { testName: 'Total Cholesterol', value: '185', unit: 'mg/dL' },
  { testName: 'Triglycerides', value: '110', unit: 'mg/dL' },
]
assert(
  !isExactDuplicateMeasurements(incomingDifferentTests, existing1),
  'NOT duplicate when tests are completely different'
)

// 6. Same Values, Different Units
const incomingDifferentUnits = [
  { testName: 'Hemoglobin', value: '13.8', unit: 'g/dL' },
  { testName: 'WBC Count', value: '7300', unit: '/µL' },
  { testName: 'Vitamin D', value: '21', unit: 'nmol/L' }, // nmol/L != ng/mL
]
assert(
  !isExactDuplicateMeasurements(incomingDifferentUnits, existing1),
  'NOT duplicate when units differ (ng/mL vs nmol/L)'
)

// 7. Categorical / Text Values Match
const existingCategorical = [
  { test_name_normalized: 'Urine Blood', value_numeric: null, value_text: 'Negative', unit: null },
  { test_name_normalized: 'Urine Protein', value_numeric: null, value_text: 'Trace', unit: null },
]

const incomingCategoricalMatch = [
  { testName: 'Urine Blood', value: 'negative', unit: '' },
  { testName: 'Urine Protein', value: 'Trace ', unit: '' },
]
assert(
  isExactDuplicateMeasurements(incomingCategoricalMatch, existingCategorical),
  'Duplicate detected for categorical text values (case-insensitive and trimmed)'
)

const incomingCategoricalMismatch = [
  { testName: 'Urine Blood', value: 'Positive', unit: '' },
  { testName: 'Urine Protein', value: 'Trace', unit: '' },
]
assert(
  !isExactDuplicateMeasurements(incomingCategoricalMismatch, existingCategorical),
  'NOT duplicate when categorical text value differs (Positive vs Negative)'
)

console.log(`\n======================================================`)
console.log(`Duplicate Detection Unit Tests: ${passed} passed, ${failed} failed`)
console.log(`======================================================`)

if (failed > 0) process.exit(1)
