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
    schemaVersion: Number(new URLSearchParams(location.search).get("schema") || 3),
    reads: {},
    trips: [{
      id: "00000000-0000-4000-8000-000000000010",
      user_id: user.id,
      trip_date: "2026-07-14",
      trip_end_date: "2026-07-14",
      start_address: "Synthetic Depot",
      stops: [],
      end_address: "Synthetic Office",
      distance_km: 12.5,
      round_trip: false,
      purpose: "Meeting",
      client_project: "Fixture baseline",
      vehicle: null,
      vehicle_registration: null,
      claim_method: "record_only",
      rate_cents: 0,
      odometer_start: null,
      odometer_end: null,
      notes: "Existing synthetic trip",
      created_at: "2026-07-14T01:00:00.000Z",
    }],
  };

  const clone = (value) => structuredClone(value);

  class Query {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.payload = undefined;
      this.filters = [];
      this.singleRow = false;
    }
    select() { this.operation = "select"; return this; }
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
        const rows = this.table === "profiles" ? [profile] : this.table === "trips" ? state.trips : [];
        const selected = rows.filter((row) => this.matches(row)).map(clone);
        return { data: this.singleRow ? selected[0] : selected, error: null };
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
