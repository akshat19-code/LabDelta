/**
 * LabΔ Synthetic Demo Data Engine
 * Provides authentic, multi-report demonstration data showcasing:
 * - Deterministic normalization across aliases (HGB, Haemoglobin, Hemoglobin, Plt)
 * - Changed, unchanged, new, and missing marker classifications in Compare
 * - Categorical/textual values ("Borderline")
 * - Intentional unit mismatch isolation (ng/mL vs nmol/L for Vitamin D)
 * - Chronological Trends line chart across repeated observations
 *
 * Safety Guarantees:
 * - Explicit user-triggered action only (NEVER auto-seeded)
 * - Deterministic detection via source_type = 'demo' (NEVER confuses user-created reports)
 * - NEVER overwrites or deletes real user reports
 * - Inserts strictly via authenticated Supabase RLS session
 */

import { supabase } from './supabase'
import { normalizeTestName } from './normalization'

export const DEMO_REPORTS = [
  {
    report_date: '2026-01-15',
    lab_name: 'City Labs (Demo)',
    source_type: 'demo',
    measurements: [
      {
        test_name_raw: 'Hemoglobin',
        value_numeric: 13.8,
        value_text: null,
        unit: 'g/dL',
        reference_min: 13,
        reference_max: 17,
        reference_text: '13 – 17',
      },
      {
        test_name_raw: 'WBC',
        value_numeric: 7100,
        value_text: null,
        unit: '/µL',
        reference_min: 4000,
        reference_max: 11000,
        reference_text: '4000 – 11000',
      },
      {
        test_name_raw: 'Platelets',
        value_numeric: 245000,
        value_text: null,
        unit: '/µL',
        reference_min: 150000,
        reference_max: 450000,
        reference_text: '150000 – 450000',
      },
      {
        test_name_raw: 'Fasting Glucose',
        value_numeric: 94,
        value_text: null,
        unit: 'mg/dL',
        reference_min: 70,
        reference_max: 99,
        reference_text: '70 – 99',
      },
      {
        test_name_raw: 'Vitamin D',
        value_numeric: 17,
        value_text: null,
        unit: 'ng/mL',
        reference_min: 30,
        reference_max: 100,
        reference_text: '30 – 100',
      },
      {
        test_name_raw: 'Total Cholesterol',
        value_numeric: 210,
        value_text: null,
        unit: 'mg/dL',
        reference_min: null,
        reference_max: null,
        reference_text: '<200',
      },
    ],
  },
  {
    report_date: '2026-04-15',
    lab_name: 'HealthLab (Demo)',
    source_type: 'demo',
    measurements: [
      {
        test_name_raw: 'HGB',
        value_numeric: 13.2,
        value_text: null,
        unit: 'g/dL',
        reference_min: 13,
        reference_max: 17,
        reference_text: '13 – 17',
      },
      {
        test_name_raw: 'WBC',
        value_numeric: 7300,
        value_text: null,
        unit: '/µL',
        reference_min: 4000,
        reference_max: 11000,
        reference_text: '4000 – 11000',
      },
      {
        test_name_raw: 'Plt',
        value_numeric: 245000,
        value_text: null,
        unit: '/µL',
        reference_min: 150000,
        reference_max: 450000,
        reference_text: '150000 – 450000',
      },
      {
        test_name_raw: 'Fasting Glucose',
        value_numeric: 98,
        value_text: null,
        unit: 'mg/dL',
        reference_min: 70,
        reference_max: 99,
        reference_text: '70 – 99',
      },
      {
        test_name_raw: 'Vitamin D',
        value_numeric: 21,
        value_text: null,
        unit: 'ng/mL',
        reference_min: 30,
        reference_max: 100,
        reference_text: '30 – 100',
      },
      {
        test_name_raw: 'TSH',
        value_numeric: 3.2,
        value_text: null,
        unit: 'µIU/mL',
        reference_min: 0.4,
        reference_max: 4.0,
        reference_text: '0.4 – 4.0',
      },
      {
        test_name_raw: 'Total Cholesterol',
        value_numeric: 195,
        value_text: null,
        unit: 'mg/dL',
        reference_min: null,
        reference_max: null,
        reference_text: '<200',
      },
    ],
  },
  {
    report_date: '2026-07-15',
    lab_name: 'Demo Diagnostics (Demo)',
    source_type: 'demo',
    measurements: [
      {
        test_name_raw: 'Haemoglobin',
        value_numeric: 12.8,
        value_text: null,
        unit: 'g/dL',
        reference_min: 12.5,
        reference_max: 16.5,
        reference_text: '12.5 – 16.5',
      },
      {
        test_name_raw: 'WBC',
        value_numeric: 7600,
        value_text: null,
        unit: '/µL',
        reference_min: 4000,
        reference_max: 11000,
        reference_text: '4000 – 11000',
      },
      {
        test_name_raw: 'Platelets',
        value_numeric: 250000,
        value_text: null,
        unit: '/µL',
        reference_min: 150000,
        reference_max: 450000,
        reference_text: '150000 – 450000',
      },
      {
        test_name_raw: 'Fasting Glucose',
        value_numeric: 104,
        value_text: null,
        unit: 'mg/dL',
        reference_min: 70,
        reference_max: 99,
        reference_text: '70 – 99',
      },
      {
        test_name_raw: 'Vitamin D',
        value_numeric: 52,
        value_text: null,
        unit: 'nmol/L', // INTENTIONAL UNIT MISMATCH with ng/mL
        reference_min: null,
        reference_max: null,
        reference_text: '75 – 250',
      },
      {
        test_name_raw: 'Total Cholesterol',
        value_numeric: null,
        value_text: 'Borderline', // Categorical example
        unit: null,
        reference_min: null,
        reference_max: null,
        reference_text: 'Desirable: <200',
      },
    ],
  },
  {
    report_date: '2026-09-15',
    lab_name: 'City Labs (Demo)',
    source_type: 'demo',
    measurements: [
      {
        test_name_raw: 'Hemoglobin',
        value_numeric: 12.8,
        value_text: null,
        unit: 'g/dL',
        reference_min: 13,
        reference_max: 17,
        reference_text: '13 – 17',
      },
      {
        test_name_raw: 'WBC',
        value_numeric: 6900,
        value_text: null,
        unit: '/µL',
        reference_min: 4000,
        reference_max: 11000,
        reference_text: '4000 – 11000',
      },
      {
        test_name_raw: 'Fasting Glucose',
        value_numeric: 108,
        value_text: null,
        unit: 'mg/dL',
        reference_min: 70,
        reference_max: 99,
        reference_text: '70 – 99',
      },
      {
        test_name_raw: 'Total Cholesterol',
        value_numeric: 188,
        value_text: null,
        unit: 'mg/dL',
        reference_min: null,
        reference_max: null,
        reference_text: '<200',
      },
      {
        test_name_raw: 'Vitamin D',
        value_numeric: 32,
        value_text: null,
        unit: 'ng/mL',
        reference_min: 30,
        reference_max: 100,
        reference_text: '30 – 100',
      },
      {
        test_name_raw: 'TSH',
        value_numeric: 2.9,
        value_text: null,
        unit: 'µIU/mL',
        reference_min: 0.4,
        reference_max: 4.0,
        reference_text: '0.4 – 4.0',
      },
      // Platelets absent intentionally in this panel to showcase Missing marker in Compare
    ],
  },
  {
    report_date: '2026-09-20',
    lab_name: 'Metro Health (Demo)',
    source_type: 'demo',
    measurements: [
      {
        test_name_raw: 'Hemoglobin',
        value_numeric: 13.6,
        value_text: null,
        unit: 'g/dL',
        reference_min: 13.0,
        reference_max: 17.0,
        reference_text: '13.0 – 17.0',
      },
      {
        test_name_raw: 'WBC',
        value_numeric: 7000,
        value_text: null,
        unit: '/µL',
        reference_min: 4000,
        reference_max: 11000,
        reference_text: '4000 – 11000',
      },
      {
        test_name_raw: 'Platelets',
        value_numeric: 248000,
        value_text: null,
        unit: '/µL',
        reference_min: 150000,
        reference_max: 450000,
        reference_text: '150000 – 450000',
      },
      {
        test_name_raw: 'Fasting Glucose',
        value_numeric: 96,
        value_text: null,
        unit: 'mg/dL',
        reference_min: 70,
        reference_max: 99,
        reference_text: '70 – 99',
      },
      {
        test_name_raw: 'Total Cholesterol',
        value_numeric: 182,
        value_text: null,
        unit: 'mg/dL',
        reference_min: null,
        reference_max: null,
        reference_text: '<200',
      },
      {
        test_name_raw: 'Vitamin D',
        value_numeric: 36,
        value_text: null,
        unit: 'ng/mL',
        reference_min: 30,
        reference_max: 100,
        reference_text: '30 – 100',
      },
      {
        test_name_raw: 'TSH',
        value_numeric: 2.5,
        value_text: null,
        unit: 'µIU/mL',
        reference_min: 0.4,
        reference_max: 4.0,
        reference_text: '0.4 – 4.0',
      },
    ],
  },
]

/**
 * Checks whether demo data is already present for the current user.
 * Deterministic detection checks for source_type = 'demo' on reports belonging to the user.
 * Does NOT misclassify real user reports named "City Labs".
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function hasDemoData(userId) {
  if (!supabase || !userId) return false

  try {
    const { count, error } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_type', 'demo')

    if (error) throw error
    return (count || 0) > 0
  } catch (err) {
    console.error('Error checking demo data status:', err)
    return false
  }
}

/**
 * Loads the synthetic demo reports for the authenticated user into Supabase.
 * Respects RLS and preserves any existing user reports.
 *
 * @param {string} userId
 * @returns {Promise<{ success: boolean, reportIds: string[], message?: string }>}
 */
export async function loadDemoData(userId) {
  if (!supabase || !userId) {
    return { success: false, reportIds: [], message: 'Supabase client or session not ready.' }
  }

  try {
    const createdReportIds = []

    for (const reportDef of DEMO_REPORTS) {
      // 1. Insert Report
      const { data: repData, error: repError } = await supabase
        .from('reports')
        .insert({
          user_id: userId,
          report_date: reportDef.report_date,
          lab_name: reportDef.lab_name,
          source_type: 'demo',
        })
        .select('id')
        .single()

      if (repError) throw repError
      const reportId = repData.id
      createdReportIds.push(reportId)

      // 2. Prepare normalized measurements
      const measurementRows = reportDef.measurements.map((m) => ({
        report_id: reportId,
        test_name_raw: m.test_name_raw,
        test_name_normalized: normalizeTestName(m.test_name_raw),
        value_numeric: m.value_numeric,
        value_text: m.value_text,
        unit: m.unit,
        reference_min: m.reference_min,
        reference_max: m.reference_max,
        reference_text: m.reference_text,
      }))

      // 3. Insert Measurements
      const { error: measError } = await supabase
        .from('measurements')
        .insert(measurementRows)

      if (measError) throw measError
    }

    return {
      success: true,
      reportIds: createdReportIds,
      message: 'Demo workspace ready — explore Compare and Trends.',
    }
  } catch (err) {
    console.error('Error loading demo data:', err)
    return {
      success: false,
      reportIds: [],
      message: err.message || 'Failed to load synthetic demo data.',
    }
  }
}

/**
 * Safely resets the synthetic demo reports for the authenticated user.
 * Strictly deletes existing reports belonging to userId with source_type = 'demo'
 * (which automatically cascades to their measurements in PostgreSQL), then
 * re-populates the clean 5 submission-ready reports.
 * NEVER deletes or modifies real user reports.
 *
 * @param {string} userId
 * @returns {Promise<{ success: boolean, reportIds: string[], message?: string }>}
 */
export async function resetDemoData(userId) {
  if (!supabase || !userId) {
    return { success: false, reportIds: [], message: 'Supabase client or session not ready.' }
  }

  try {
    // 1. Delete existing demo reports for this user
    const { error: delError } = await supabase
      .from('reports')
      .delete()
      .eq('user_id', userId)
      .eq('source_type', 'demo')

    if (delError) throw delError

    // 2. Re-insert clean demo reports
    return await loadDemoData(userId)
  } catch (err) {
    console.error('Error resetting demo data:', err)
    return {
      success: false,
      reportIds: [],
      message: err.message || 'Failed to reset synthetic demo data.',
    }
  }
}
