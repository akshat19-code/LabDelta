/**
 * LabΔ (LabDelta) — Trends Calculation & Range Status Unit Tests
 */

import {
  computePointRangeStatus,
  formatPointReference,
  buildTrendsSummary,
  computeYAxisDomain
} from '../frontend/src/lib/trends.js';
import { cleanLabName, formatDelta, formatPercent, formatValue } from '../frontend/src/lib/formatting.js';

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failed++;
  }
}

// 1. Reference range status derivations
console.log('\n--- 1. Range Status Derivations ---');
const r1 = computePointRangeStatus(14.0, 13.0, 17.0);
assert(r1.key === 'within' && r1.label === 'Within range' && r1.tooltipLabel === 'Within provided range', '14.0 in [13.0, 17.0] is within');

const r2 = computePointRangeStatus(12.5, 13.0, 17.0);
assert(r2.key === 'below' && r2.label === 'Below range' && r2.tooltipLabel === 'Below provided range', '12.5 in [13.0, 17.0] is below');

const r3 = computePointRangeStatus(18.2, 13.0, 17.0);
assert(r3.key === 'above' && r3.label === 'Above range' && r3.tooltipLabel === 'Above provided range', '18.2 in [13.0, 17.0] is above');

const r4 = computePointRangeStatus(null, 13.0, 17.0);
assert(r4.key === 'unavailable' && r4.label === 'Range unavailable', 'null value is unavailable');

const r5 = computePointRangeStatus(50, null, null);
assert(r5.key === 'unavailable' && r5.label === 'Range unavailable', 'Missing ref min/max is unavailable');

const r6 = computePointRangeStatus('Negative', null, null);
assert(r6.key === 'unavailable', 'Categorical string is unavailable');

// 2. Reference format
console.log('\n--- 2. Reference String Formatting ---');
assert(formatPointReference({ reference_min: 13.5, reference_max: 17.5 }) === '13.5 – 17.5', 'Formats min-max');
assert(formatPointReference({ reference_min: 20 }) === '≥ 20', 'Formats min only');
assert(formatPointReference({ reference_max: 200 }) === '≤ 200', 'Formats max only');
assert(formatPointReference({ reference_text: '< 200' }) === '< 200', 'Formats text');
assert(formatPointReference({}) === 'Not provided', 'Returns Not provided when empty');

// 3. Demo string cleanup
console.log('\n--- 3. Demo Name Cleanup ---');
assert(cleanLabName('City Labs (Demo)') === 'City Labs', 'Strips (Demo)');
assert(cleanLabName('HealthLab (demo)') === 'HealthLab', 'Strips (demo)');
assert(cleanLabName('Apex Clinical Laboratories') === 'Apex Clinical Laboratories', 'Preserves clean name');

// 4. Vitamin D Unit Safety and Isolation Test
console.log('\n--- 4. Vitamin D Unit Isolation ---');
const testReports = [
  { id: 'r1', report_date: '2026-01-15', lab_name: 'HealthLab (Demo)', created_at: '2026-01-15T10:00:00Z', source_type: 'demo' },
  { id: 'r2', report_date: '2026-04-15', lab_name: 'City Labs (demo)', created_at: '2026-04-15T10:00:00Z', source_type: 'demo' },
  { id: 'r3', report_date: '2026-07-20', lab_name: 'Metro Diagnostics', created_at: '2026-07-20T10:00:00Z', source_type: 'demo' },
  { id: 'r4', report_date: '2026-09-10', lab_name: 'Evergreen Health', created_at: '2026-09-10T10:00:00Z', source_type: 'demo' },
];

const testMeasurements = [
  // Vitamin D in ng/mL
  { id: 'm1', report_id: 'r1', test_name_normalized: 'Vitamin D', value_numeric: 17, unit: 'ng/mL', reference_min: 20, reference_max: 50 },
  { id: 'm2', report_id: 'r2', test_name_normalized: 'Vitamin D', value_numeric: 21, unit: 'ng/mL', reference_min: 20, reference_max: 50 },
  // Incompatible unit: nmol/L!
  { id: 'm3', report_id: 'r3', test_name_normalized: 'Vitamin D', value_numeric: 52, unit: 'nmol/L', reference_min: 50, reference_max: 125 },
  // Another ng/mL point
  { id: 'm4', report_id: 'r4', test_name_normalized: 'Vitamin D', value_numeric: 32, unit: 'ng/mL', reference_min: 20, reference_max: 50 },
];

const summary = buildTrendsSummary(testReports, testMeasurements);
assert(summary.eligibleTests.length === 1, 'Exactly 1 eligible test (Vitamin D)');
const vitD = summary.eligibleTests[0];
assert(vitD.testName === 'Vitamin D', 'Test name matches');
assert(vitD.hasUnitMismatch === true, 'Detects unit mismatch between ng/mL and nmol/L');
assert(vitD.unitGroups.length === 2, 'Creates two strictly isolated unit groups');

const ngGroup = vitD.unitGroups.find(g => g.unitLabel === 'ng/mL');
const nmolGroup = vitD.unitGroups.find(g => g.unitLabel === 'nmol/L');

assert(ngGroup.pointsCount === 3, 'ng/mL has exactly 3 points');
assert(nmolGroup.pointsCount === 1, 'nmol/L has exactly 1 point');

// Verify nmol/L point was NEVER mixed into ng/mL calculations
assert(ngGroup.first.value === 17, 'First ng/mL value is 17');
assert(ngGroup.latest.value === 32, 'Latest ng/mL value is 32 (not 52)');
assert(ngGroup.netDelta === 15, 'Net delta is 32 - 17 = 15');
assert(ngGroup.percentChange === 88.2, 'Percentage change is +88.2%');

// Verify excluded points metadata
assert(vitD.excludedPointsCount === 1, '1 measurement excluded from primary unit');
assert(vitD.excludedUnits.includes('nmol/L'), 'Excluded units list contains nmol/L');

// 5. Duplicate Dates Disambiguation
console.log('\n--- 5. Duplicate Dates Disambiguation ---');
const dupReports = [
  { id: 'd1', report_date: '2026-05-01', lab_name: 'Lab Alpha', created_at: '2026-05-01T08:00:00Z', source_type: 'manual' },
  { id: 'd2', report_date: '2026-05-01', lab_name: 'Lab Beta', created_at: '2026-05-01T12:00:00Z', source_type: 'manual' },
  { id: 'd3', report_date: '2026-05-01', lab_name: 'Lab Beta', created_at: '2026-05-01T14:00:00Z', source_type: 'manual' },
];
const dupMeasurements = [
  { id: 'dm1', report_id: 'd1', test_name_normalized: 'Hemoglobin', value_numeric: 13.5, unit: 'g/dL', reference_min: 13, reference_max: 17 },
  { id: 'dm2', report_id: 'd2', test_name_normalized: 'Hemoglobin', value_numeric: 13.7, unit: 'g/dL', reference_min: 13, reference_max: 17 },
  { id: 'dm3', report_id: 'd3', test_name_normalized: 'Hemoglobin', value_numeric: 13.8, unit: 'g/dL', reference_min: 13, reference_max: 17 },
];
const dupSummary = buildTrendsSummary(dupReports, dupMeasurements);
const hemoPoints = dupSummary.eligibleTests[0].primaryGroup.points;

assert(hemoPoints.length === 3, '3 points plotted');
assert(hemoPoints[0].isDuplicateDate === true, 'Point 0 is duplicate date');
assert(hemoPoints[0].isDuplicateDateAndLab === false, 'Point 0 (Lab Alpha) has unique lab, so isDuplicateDateAndLab is false');
assert(hemoPoints[1].isDuplicateDateAndLab === true, 'Point 1 (Lab Beta) shares date AND lab with Point 2');
assert(hemoPoints[2].isDuplicateDateAndLab === true, 'Point 2 (Lab Beta) shares date AND lab with Point 1');
assert(hemoPoints[0].chartTick.includes('(1)'), 'Chart ticks are disambiguated for categorical XAxis');
assert(hemoPoints[1].chartTick.includes('(2)'), 'Chart ticks are disambiguated for categorical XAxis');

console.log(`\n======================================================`);
console.log(`Trends Unit Verification: ${passed} passed, ${failed} failed`);
console.log(`======================================================`);
if (failed > 0) process.exit(1);
