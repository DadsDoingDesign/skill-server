import { api } from "./lib/api.js";
import { getState, setState, subscribe } from "./lib/state.js";
import { parseHash, onChange, go } from "./lib/router.js";
import { toast } from "./lib/toast.js";
import { mountHeader } from "./components/header.js";
import { mountSidebar } from "./components/sidebar.js";
import { renderHome } from "./components/home.js";
import { renderReader } from "./components/reader.js";
import { renderEditor } from "./components/editor.js";
import "./components/drag-overlay.js";

const content = document.querySelector('[data-mount="content"]');

// ---- Public API for components ---------------------------------

export async function loadSkills() {
  const { search } = getState();
  const url = search ? `/api/skills?q=${encodeURIComponent(search)}` : "/api/skills";
  try {
    const skills = await api(url);
    setState({ skills });
  } catch (e) {
    toast(`Could not load skills: ${e.message}`, "negative");
  }
}

export async function refreshAuth() {
  try {
    const { admin, authRequired } = await api("/api/whoami");
    setState({ admin, authRequired });
    return admin;
  } catch {
    setState({ admin: false, authRequired: true });
    return false;
  }
}

// ---- Routing ---------------------------------------------------

async function renderRoute() {
  const route = parseHash();
  const { admin } = getState();

  // Guard write routes
  if ((route.name === "editor" || route.name === "new") && !admin) {
    if (route.name === "editor" && route.skill) {
      go(`skill/${encodeURIComponent(route.skill)}`);
      return;
    }
    go("home");
    return;
  }

  if (route.name === "home") return renderHome(content);
  if (route.name === "reader") return renderReader(content, route.skill);
  if (route.name === "editor") return renderEditor(content, route.skill, { creating: false });
  if (route.name === "new") return renderEditor(content, null, { creating: true });
}

// ---- Bootstrap -------------------------------------------------

document.documentElement.setAttribute("data-theme", getState().theme);

mountHeader();
mountSidebar();

onChange(renderRoute);

let lastSearch = "";
subscribe(({ search }) => {
  if (search !== lastSearch) {
    lastSearch = search;
    loadSkills();
  }
});

(async () => {
  await refreshAuth();
  await loadSkills();
  renderRoute();
})();
