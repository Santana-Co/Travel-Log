// Disposable PostgreSQL only. No connection URL, .pgpass, external host or real data.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const bin = process.env.PG_BINDIR || spawnSync("pg_config", ["--bindir"], { encoding: "utf8" }).stdout?.trim();
if (!bin || !fs.existsSync(path.join(bin, "initdb"))) throw new Error("Install PostgreSQL server tools for disposable testing; set PG_BINDIR if needed. No live database is supported.");
const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "travel-log-vehicles-test-"));
fs.chmodSync(temporary, 0o700);
const cluster = path.join(temporary, "cluster");
const log = path.join(temporary, "postgres.log");
// Deliberately do not inherit PGHOST, PGSERVICE, PGPASSWORD, PGOPTIONS or credentials.
const env = { PATH: process.env.PATH, LC_ALL: "C" };
const admin = "vehicle_test_admin";
const args = ["-X", "-w", "-h", temporary, "-p", "55432", "-U", admin, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"];
const migration = fs.readFileSync(path.join(root, "supabase/reusable-vehicles-migration.sql"), "utf8");
let assertions = 0;
let started = false;
function command(name, argv, input) {
  const result = spawnSync(path.join(bin, name), argv, { env, input, encoding: "utf8", timeout: 60000 });
  if (result.error) throw result.error;
  return result;
}
function sql(input) {
  const result = command("psql", args, input);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fails(input, pattern) {
  const result = command("psql", args, input);
  assert.notEqual(result.status, 0, "Expected SQL rejection");
  assert.match(result.stderr, pattern);
  assertions++;
}
function equal(input, expected) { assert.equal(sql(input), expected); assertions++; }
const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const va = "00000000-0000-4000-8000-000000000011";
const vb = "00000000-0000-4000-8000-000000000012";
const asUser = (id, statement) => `set role authenticated; set request.jwt.claim.sub = '${id}'; ${statement}`;
function userResult(id, statement) { return sql(asUser(id, statement)).split("\n").filter((line) => line !== "SET").join("\n"); }
function userEqual(id, statement, expected) { assert.equal(userResult(id, statement), expected); assertions++; }
try {
  assert.equal(command("initdb", ["-D", cluster, "-U", admin, "--auth-local=trust", "--auth-host=reject", "--encoding=UTF8", "--locale=C"]).status, 0);
  // Empty listen_addresses means Unix socket only; no network listener is started.
  const start = command("pg_ctl", ["-D", cluster, "-l", log, "-o", `-F -h '' -k '${temporary}' -p 55432`, "-w", "start"]);
  assert.equal(start.status, 0, start.stderr);
  started = true;
  sql(`create role authenticated; create role anon;
    create schema auth; create schema private;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated, anon;
    create table private.app_schema_state (singleton boolean primary key, schema_version integer not null, updated_at timestamptz default now());
    insert into private.app_schema_state values (true, 5, now());
    insert into auth.users values ('${a}'), ('${b}');
    create table public.trips (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, vehicle text, vehicle_registration text);
    alter table public.trips enable row level security;
    create policy own_trip on public.trips to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    grant select, insert, update, delete on public.trips to authenticated;
    insert into public.trips (user_id, vehicle, vehicle_registration) values ('${a}', 'Historical synthetic vehicle', 'OLD123');`);
  const originalTrips = sql("select json_agg(t order by id)::text from public.trips t;");
  const originalPolicies = sql("select policyname || ':' || qual || ':' || with_check from pg_policies where tablename = 'trips';");
  sql("update private.app_schema_state set schema_version = 4;");
  fails(migration, /Expected application schema version 5 or 6/);
  equal("select to_regclass('public.vehicles') is null;", "t");
  sql("delete from private.app_schema_state;");
  fails(migration, /Expected application schema version 5 or 6/);
  sql("insert into private.app_schema_state values (true, 5, now()); create table public.vehicles (unexpected text);");
  fails(migration, /Unexpected vehicles table/);
  sql("drop table public.vehicles;");
  sql(migration);
  equal("select schema_version from private.app_schema_state;", "6");
  equal("select count(*) from public.vehicles;", "0");
  equal("select json_agg(t order by id)::text from public.trips t;", originalTrips);
  equal("select policyname || ':' || qual || ':' || with_check from pg_policies where tablename = 'trips';", originalPolicies);
  equal("select relrowsecurity from pg_class where oid = 'public.vehicles'::regclass;", "t");
  equal("select count(*) from pg_policies where tablename = 'vehicles';", "3");
  equal("select count(*) from pg_indexes where tablename = 'vehicles' and indexname = 'vehicles_user_id_idx';", "1");
  // All ownership assertions use the non-privileged authenticated role with distinct UIDs.
  sql(asUser(a, `insert into public.vehicles (id, user_id, label, registration) values ('${va}', '${a}', 'Synthetic A', 'A123');`));
  sql(asUser(b, `insert into public.vehicles (id, user_id, label, registration) values ('${vb}', '${b}', 'Synthetic B', 'B123');`));
  userEqual(a, "select label from public.vehicles;", "Synthetic A");
  userEqual(b, "select label from public.vehicles;", "Synthetic B");
  for (const [caller, foreign, foreignId] of [[a, b, vb], [b, a, va]]) {
    userEqual(caller, `select count(*) from public.vehicles where id = '${foreignId}';`, "0");
    fails(asUser(caller, `insert into public.vehicles (user_id, label) values ('${foreign}', 'Spoofed');`), /row-level security/);
    userEqual(caller, `with changed as (update public.vehicles set label = 'Cross-user edit' where id = '${foreignId}' returning id) select count(*) from changed;`, "0");
    fails(asUser(caller, `update public.vehicles set user_id = '${foreign}';`), /permission denied/);
    fails(asUser(caller, `delete from public.vehicles where id = '${foreignId}';`), /permission denied/);
  }
  fails("set role anon; select * from public.vehicles;", /permission denied/);
  fails("set role anon; insert into public.vehicles (user_id, label) values ('" + a + "', 'Anonymous');", /permission denied/);
  fails("set role authenticated; select set_config('request.jwt.claim.sub', '', false); insert into public.vehicles (user_id, label) values ('" + a + "', 'No UID');", /row-level security/);
  fails(asUser(a, "insert into public.vehicles (user_id, label) values ('" + a + "', '   ');"), /vehicles_label_valid/);
  fails(asUser(a, "insert into public.vehicles (user_id, label) values ('" + a + "', repeat('x', 121));"), /vehicles_label_valid/);
  fails(asUser(a, "update public.vehicles set registration = repeat('x', 21);"), /vehicles_registration_valid/);
  fails(asUser(a, "update public.vehicles set archived = null;"), /not-null/);
  fails(asUser(a, "update public.vehicles set created_at = now();"), /permission denied/);
  fails(asUser(a, "delete from public.vehicles;"), /permission denied/);
  sql(asUser(a, "update public.vehicles set label = 'Renamed A', registration = 'NEW123', archived = true;"));
  userEqual(a, "select label || ':' || archived from public.vehicles;", "Renamed A:true");
  userEqual(a, "select updated_at > created_at from public.vehicles;", "t");
  equal("select json_agg(t order by id)::text from public.trips t;", originalTrips);
  // Old schema-5 trip writes omit vehicles entirely and remain valid under schema 6.
  sql(asUser(a, "insert into public.trips (user_id, vehicle, vehicle_registration) values ('" + a + "', 'Old client snapshot', 'LEGACY');"));
  userEqual(a, "select vehicle_registration from public.trips where vehicle = 'Old client snapshot';", "LEGACY");
  sql(asUser(a, "update public.trips set vehicle = 'Old client edited snapshot' where vehicle_registration = 'LEGACY';"));
  userEqual(a, "select vehicle from public.trips where vehicle_registration = 'LEGACY';", "Old client edited snapshot");
  sql(asUser(a, "delete from public.trips where vehicle_registration = 'LEGACY';"));
  const beforeRepeat = sql("select json_agg(v order by id)::text from public.vehicles v;");
  sql(migration);
  equal("select json_agg(v order by id)::text from public.vehicles v;", beforeRepeat);
  equal("select json_agg(t order by id)::text from public.trips t;", originalTrips);
  sql(asUser(a, "update public.vehicles set archived = false;"));
  userEqual(a, "select archived from public.vehicles;", "f");
  // Exact synthetic parent deletion proves FK cleanup; no application RPC was changed.
  sql(`delete from auth.users where id = '${a}';`);
  equal(`select count(*) from public.vehicles where user_id = '${a}';`, "0");
  equal(`select count(*) from public.vehicles where user_id = '${b}';`, "1");
  sql("update private.app_schema_state set schema_version = 7;");
  fails(migration, /Expected application schema version 5 or 6/);
  equal("select schema_version from private.app_schema_state;", "7");
  console.log(`Vehicle migration: ${assertions} assertions passed; transactional preconditions, idempotence, historical preservation, old-client writes, RLS and account cascade verified on disposable PostgreSQL.`);
} finally {
  if (started) {
    const stopped = command("pg_ctl", ["-D", cluster, "-m", "immediate", "-w", "stop"]);
    assert.equal(stopped.status, 0, "Disposable server could not be stopped; retain directory for inspection.");
  }
  fs.rmSync(temporary, { recursive: true, force: true });
}
