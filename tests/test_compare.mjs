/**
 * LabΔ (LabDelta) — Compare Range Status Derivation Unit Tests
 */

import { evaluateRangeStatus } from '../frontend/src/lib/comparison.js';

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

console.log("=== Compare Range Status Derivation Verification ===");

// 1. Fasting Glucose 108 / Ref 70-99
const glucoseStatus = evaluateRangeStatus(108, 70, 99);
assert(glucoseStatus === 'above', "Fasting Glucose 108 in [70, 99] derives 'above' (Above provided range)");

// 2. Hemoglobin 12.8 / Ref 13-17
const hemoStatus = evaluateRangeStatus(12.8, 13, 17);
assert(hemoStatus === 'below', "Hemoglobin 12.8 in [13, 17] derives 'below' (Below provided range)");

// 3. In-range value: Hemoglobin 13.8 / Ref 13.5-17.5
const inRangeStatus = evaluateRangeStatus(13.8, 13.5, 17.5);
assert(inRangeStatus === 'within', "Hemoglobin 13.8 in [13.5, 17.5] derives 'within' (Within provided range)");

// 4. In-range value: Fasting Glucose 96 / Ref 70-99
const glucoseJanStatus = evaluateRangeStatus(96, 70, 99);
assert(glucoseJanStatus === 'within', "Fasting Glucose 96 in [70, 99] derives 'within' (Within provided range)");

// 5. Total Cholesterol 210 with no numeric min/max
const cholStatus = evaluateRangeStatus(210, null, null);
assert(cholStatus === null, "Total Cholesterol with non-numeric ref derives null (Range unavailable)");

// 6. Urine Protein categorical 'Negative'
const urineStatus = evaluateRangeStatus(null, null, null);
assert(urineStatus === null, "Categorical value with null numeric derives null (no forced status)");

console.log(`\n======================================================`);
console.log(`Compare Unit Verification: ${passed} passed, ${failed} failed`);
console.log(`======================================================`);
if (failed > 0) process.exit(1);
