// Hash router. Routes:
//   #/                       -> { name: 'home' }
//   #/skill/<name>           -> { name: 'reader', skill: <name> }
//   #/skill/<name>/edit      -> { name: 'editor', skill: <name> }
//   #/new                    -> { name: 'new' }

const subs = new Set();

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  if (!raw) return { name: "home" };
  if (raw === "new") return { name: "new" };
  const m = raw.match(/^skill\/([^/]+)(\/edit)?$/);
  if (m) return { name: m[2] ? "editor" : "reader", skill: decodeURIComponent(m[1]) };
  return { name: "home" };
}

export function go(route) {
  if (route === "home" || route === "/") { location.hash = "#/"; return; }
  if (route === "new") { location.hash = "#/new"; return; }
  if (route.startsWith("skill/")) { location.hash = "#/" + route; return; }
  location.hash = "#/" + route;
}

export function onChange(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

window.addEventListener("hashchange", () => {
  const r = parseHash();
  for (const fn of subs) fn(r);
});
