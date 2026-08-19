const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "theme.js"), "utf8");

function loadTheme(storedTheme) {
  const values = new Map(storedTheme ? [["travel-log-appearance", storedTheme]] : []);
  const document = { documentElement: { dataset: {}, style: {} } };
  const window = {};
  const localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  vm.runInNewContext(source, { document, localStorage, Set, window });
  return { document, values, theme: window.TravelLogTheme };
}

test("loads a saved appearance and persists a new valid selection", () => {
  const state = loadTheme("dark");
  assert.equal(state.document.documentElement.dataset.theme, "dark");
  assert.equal(state.document.documentElement.style.colorScheme, "dark");
  assert.equal(state.theme.apply("light"), "light");
  assert.equal(state.values.get("travel-log-appearance"), "light");
});

test("uses system mode for missing or invalid appearance values", () => {
  const state = loadTheme("unknown");
  assert.equal(state.document.documentElement.dataset.theme, "system");
  assert.equal(state.document.documentElement.style.colorScheme, "light dark");
  assert.equal(state.theme.normalize(null), "system");
});
