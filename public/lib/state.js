// Tiny pub/sub store. Subscribers get the full state on every change.
const subs = new Set();

const state = {
  skills: [],
  current: null,        // { name, description, body, metadata } or null
  admin: false,
  authRequired: false,
  theme: localStorage.getItem("theme") || "light",
  search: "",
  loading: false,
};

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of subs) fn(state);
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
