// Vitest global setup
// happy-dom provides localStorage, but guard against edge cases
if (typeof globalThis.localStorage === 'undefined') {
  const store = {}
  globalThis.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => {
      store[key] = String(val)
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k])
    }
  }
}
