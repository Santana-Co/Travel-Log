(function installSyntheticSupabaseFixture() {
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "browser-test@example.invalid",
    user_metadata: { full_name: "Browser Test User" },
  };
  const profile = {
    id: user.id,
    full_name: "Browser Test User",
    privacy_version: "2026-08-20-ato-logbook",
    privacy_accepted_at: "2026-01-01T00:00:00.000Z",
    appearance_theme: "system",
    recording_mode: new URLSearchParams(location.search).get("mode") || "general",
  };
  const state = {
    schemaVersion: Number(new URLSearchParams(location.search).get("schema") || 6),
    vehicles: [],
    reads: {},
    logbookPeriods: [{
      id: "00000000-0000-4000-8000-000000000020",
      user_id: user.id,
      vehicle_registration: "ODO123",
      vehicle_description: "Synthetic odometer vehicle",
      engine_capacity: null,
      start_date: "2026-07-01",
      end_date: "2026-09-22",
      opening_odometer: 900,
      closing_odometer: 2000,
    }],
    trips: [{
      id: "00000000-0000-4000-8000-000000000010",
      user_id: user.id,
      classification: "unclassified",
      distance_source: "unknown",
      manual_distance_reason: null,
      manual_distance_note: null,
      trip_date: "2026-07-14",
      trip_end_date: "2026-07-14",
      start_address: "Synthetic Depot",
      stops: ["Synthetic Stop"],
      end_address: "Synthetic Office",
      distance_km: 12.5,
      round_trip: true,
      purpose: "Meeting",
      client_project: "Fixture baseline",
      vehicle: "Synthetic Ute",
      vehicle_registration: "TEST123",
      claim_method: "record_only",
      rate_cents: 0,
      odometer_start: null,
      odometer_end: null,
      notes: "Existing synthetic trip",
      created_at: "2026-07-14T01:00:00.000Z",
    }],
  };

  state.annualRecords = [];
  // Only synthetic boundary data; this scenario never contacts Supabase.
  if (new URLSearchParams(location.search).has("reporting")) {
    const baseline = state.trips[0];
    const row = (suffix, date, distance, extra = {}) => ({ ...baseline, id: `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`, trip_date: date, trip_end_date: date, distance_km: distance, round_trip: false, classification: "work", claim_method: "employer", rate_cents: 50, client_project: "Synthetic FY client", notes: `Synthetic FY ${suffix}`, ...extra });
    state.trips = [
      row(101, "2025-06-30", 999),
      row(102, "2025-07-01", 4000),
      row(103, "2026-06-30", 2000, { trip_end_date: "2026-07-02", distance_source: "manual", manual_distance_reason: "actual_route_differed", manual_distance_note: "Synthetic detour evidence" }),
      row(104, "2026-02-01", 100, { classification: "personal", distance_source: "route_calculated" }),
      row(105, "2026-02-02", 50, { classification: "unclassified" }),
      row(106, "2026-07-01", 300),
      row(107, "2024-02-29", 25),
    ];
    if (profile.recording_mode === "ato_logbook") {
      state.trips[1].claim_method = "ato_logbook";
      state.logbookPeriods = [{ ...state.logbookPeriods[0], vehicle_registration: "TEST123", start_date: "2025-07-01", end_date: "2025-09-30", opening_odometer: 0, closing_odometer: 10000 }];
      state.annualRecords = [2025, 2026].map((year) => ({ id: `annual-${year}`, user_id: user.id, vehicle_registration: "TEST123", logbook_period_id: state.logbookPeriods[0].id, income_year_start: year, opening_odometer: 0, closing_odometer: year === 2025 ? 20000 : 10000, circumstances_changed: false }));
    }
  }

  const clone = (value) => structuredClone(value);

  class Query {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.payload = undefined;
      this.filters = [];
      this.singleRow = false;
    }
    select() { this.returnRows = true; return this; }
    insert(payload) { this.operation = "insert"; this.payload = payload; return this; }
    update(payload) { this.operation = "update"; this.payload = payload; return this; }
    delete() { this.operation = "delete"; return this; }
    upsert(payload) { this.operation = "upsert"; this.payload = payload; return this; }
    eq(column, value) { this.filters.push([column, value]); return this; }
    order() { return this; }
    single() { this.singleRow = true; return this; }
    then(resolve, reject) { return this.execute().then(resolve, reject); }

    matches(row) { return this.filters.every(([column, value]) => row[column] === value); }

    async execute() {
      if (this.operation === "select") {
        state.reads[this.table] = (state.reads[this.table] || 0) + 1;
        const rows = this.table === "profiles" ? [profile] : this.table === "trips" ? state.trips : this.table === "vehicles" ? state.vehicles : this.table === "logbook_periods" ? state.logbookPeriods : this.table === "logbook_income_years" ? state.annualRecords : [];
        const selected = rows.filter((row) => this.matches(row)).map(clone);
        return { data: this.singleRow ? selected[0] : selected, error: null };
      }
      if (this.table === "vehicles") {
        if (state.failVehicleWrite) return { data: null, error: { message: "Synthetic save failure" } };
        let changed = [];
        if (this.operation === "insert") {
          const stored = { archived: false, ...clone(this.payload), created_at: "2026-09-09T14:30:00.000Z", updated_at: "2026-09-09T14:30:00.000Z" };
          state.vehicles.push(stored);
          changed = [stored];
        } else if (this.operation === "update") {
          state.vehicles = state.vehicles.map((row) => {
            if (!this.matches(row)) return row;
            const stored = { ...row, ...clone(this.payload), updated_at: "2026-09-10T14:30:00.000Z" };
            changed.push(stored);
            return stored;
          });
        } else throw new Error(`Unexpected vehicle operation ${this.operation}`);
        return { data: this.returnRows ? clone(this.singleRow ? changed[0] : changed) : null, error: null };
      }
      if (this.table !== "trips") throw new Error(`Unexpected write to ${this.table}`);
      if (this.operation === "insert" || this.operation === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        for (const row of rows) {
          const index = state.trips.findIndex((trip) => trip.id === row.id);
          const stored = { ...clone(row), created_at: state.trips[index]?.created_at || "2026-09-09T14:30:00.000Z" };
          if (index >= 0) state.trips[index] = stored;
          else state.trips.push(stored);
        }
      } else if (this.operation === "update") {
        state.trips = state.trips.map((trip) => this.matches(trip) ? { ...trip, ...clone(this.payload) } : trip);
      } else if (this.operation === "delete") {
        state.trips = state.trips.filter((trip) => !this.matches(trip));
      }
      return { data: null, error: null };
    }
  }

  const auth = {
    getSession: async () => ({ data: { session: { user, access_token: "synthetic-access-token" } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  };
  const client = {
    auth,
    from: (table) => new Query(table),
    rpc: async (name) => {
      if (name !== "get_app_schema_version") throw new Error(`Unexpected RPC: ${name}`);
      return { data: state.schemaVersion, error: null };
    },
  };

  window.__travelLogFixture = state;
  window.supabase = { createClient: () => client };
})();
