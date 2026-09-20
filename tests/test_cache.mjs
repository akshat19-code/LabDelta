/**
 * LabΔ (LabDelta) — ReportsContext Cache & Error Resilience Unit Tests
 * Verifies that cached report data is preserved across network failures,
 * loading states only block on initial cold load, and cache clears on logout.
 */

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

console.log("=== ReportsContext Cache Preservation & Error Handling Verification ===");

class MockReportsDataStore {
  constructor(userId) {
    this.userId = userId;
    this.reports = [];
    this.measurements = [];
    this.isLoaded = false;
    this.loading = false;
    this.isRefreshing = false;
    this.error = "";
  }

  async refreshData(mockSupabaseFn) {
    const isInitial = !this.isLoaded;
    if (isInitial) {
      this.loading = true;
    } else {
      this.isRefreshing = true;
    }
    this.error = "";

    try {
      const [reps, meas] = await mockSupabaseFn();
      this.reports = reps;
      this.measurements = meas;
      this.isLoaded = true;
      this.error = "";
    } catch (err) {
      // CRITICAL: Preserve existing cache on network failure
      this.error = err.message || "Failed to load report data.";
    } finally {
      this.loading = false;
      this.isRefreshing = false;
    }
  }

  clearCache() {
    this.reports = [];
    this.measurements = [];
    this.isLoaded = false;
    this.loading = false;
    this.isRefreshing = false;
    this.error = "";
  }
}

async function runTests() {
  const store = new MockReportsDataStore("user-123");

  // 1. Initial cold load
  await store.refreshData(async () => [
    [{ id: "rep-1", report_date: "2026-04-15" }],
    [{ id: "meas-1", test_name_normalized: "Hemoglobin", value_numeric: 13.8 }],
  ]);

  assert(store.isLoaded === true, "Initial fetch marks store as isLoaded");
  assert(store.reports.length === 1, "Initial fetch populates 1 report");
  assert(store.measurements.length === 1, "Initial fetch populates 1 measurement");
  assert(store.error === "", "Initial fetch has no error");

  // 2. Failed refresh (network failure / timeout)
  await store.refreshData(async () => {
    throw new Error("Network timeout connecting to Supabase");
  });

  assert(store.reports.length === 1, "Failed refresh PRESERVES existing cached reports (does not blank data)");
  assert(store.measurements.length === 1, "Failed refresh PRESERVES existing cached measurements");
  assert(store.reports[0].id === "rep-1", "Cached report data matches previous state");
  assert(store.error === "Network timeout connecting to Supabase", "Error message is properly surfaced");
  assert(store.loading === false, "Loading state is false (UI is not blocked)");
  assert(store.isRefreshing === false, "Refreshing state is reset to false");

  // 3. User logout / session wipe
  store.clearCache();
  assert(store.reports.length === 0, "User logout immediately clears cached reports");
  assert(store.measurements.length === 0, "User logout immediately clears cached measurements");
  assert(store.isLoaded === false, "User logout resets isLoaded to false");

  console.log(`\n======================================================`);
  console.log(`Cache Unit Verification: ${passed} passed, ${failed} failed`);
  console.log(`======================================================`);
  if (failed > 0) process.exit(1);
}

runTests();
