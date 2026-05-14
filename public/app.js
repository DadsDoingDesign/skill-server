const $ = (sel) => document.querySelector(sel);
const list = $("#skill-list");
const form = $("#skill-form");
const empty = $("#empty-state");
const search = $("#search");

let skills = [];
let current = null; // skill name being edited, or null
let creating = false;
let token = localStorage.getItem("admin-token") || "";

$("#mcp-url").textContent = `${location.origin}/mcp`;

function toast(msg, kind = "ok") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `show ${kind}`;
  setTimeout(() => t.classList.remove("show"), 2400);
}

function authHeaders(extra = {}) {
  const h = { ...extra };
  if (token) h["X-Admin-Token"] = token;
  return h;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...(opts.headers || {}), ...authHeaders() },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const ctype = res.headers.get("content-type") || "";
  return ctype.includes("application/json") ? res.json() : res.blob();
}

async function loadSkills() {
  const q = search.value.trim();
  const url = q ? `/api/skills?q=${encodeURIComponent(q)}` : "/api/skills";
  skills = await api(url);
  renderList();
}

function renderList() {
  list.innerHTML = "";
  if (!skills.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No skills yet. Click 'New skill' or import a .zip.";
    list.appendChild(li);
    return;
  }
  for (const s of skills) {
    const li = document.createElement("li");
    if (s.name === current && !creating) li.classList.add("active");
    li.innerHTML = `<span class="name"></span><span class="desc"></span>`;
    li.querySelector(".name").textContent = s.name;
    li.querySelector(".desc").textContent = s.description || "";
    li.addEventListener("click", () => openSkill(s.name));
    list.appendChild(li);
  }
}

function showForm() {
  form.hidden = false;
  empty.hidden = true;
}
function showEmpty() {
  form.hidden = true;
  empty.hidden = false;
}

async function openSkill(name) {
  creating = false;
  current = name;
  try {
    const s = await api(`/api/skills/${encodeURIComponent(name)}`);
    $("#f-name").value = s.name;
    $("#f-name").disabled = true;
    $("#f-description").value = s.description || "";
    $("#f-body").value = s.body || "";
    $("#f-delete").hidden = false;
    $("#f-delete").textContent = "Delete";
    $("#f-export").hidden = false;
    showForm();
    renderList();
  } catch (e) {
    toast(`Load failed: ${e.message}`, "error");
  }
}

function startNew() {
  creating = true;
  current = null;
  $("#f-name").value = "";
  $("#f-name").disabled = false;
  $("#f-description").value = "";
  $("#f-body").value = "# New skill\n\nDescribe what this skill does and when an agent should use it.\n";
  $("#f-delete").hidden = false;
  $("#f-delete").textContent = "Cancel";
  $("#f-export").hidden = true;
  showForm();
  renderList();
  setTimeout(() => $("#f-name").focus(), 0);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#f-name").value.trim();
  const description = $("#f-description").value.trim();
  const body = $("#f-body").value;
  try {
    if (creating) {
      await api("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, body }),
      });
      toast("Skill created", "ok");
    } else {
      await api(`/api/skills/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, body }),
      });
      toast("Saved", "ok");
    }
    creating = false;
    current = name;
    await loadSkills();
    await openSkill(name);
  } catch (err) {
    toast(`Save failed: ${err.message}`, "error");
  }
});

$("#f-delete").addEventListener("click", async () => {
  if (creating) {
    creating = false;
    current = null;
    showEmpty();
    renderList();
    return;
  }
  if (!current) return;
  if (!confirm(`Delete skill '${current}'? This cannot be undone.`)) return;
  try {
    await api(`/api/skills/${encodeURIComponent(current)}`, { method: "DELETE" });
    toast("Deleted", "ok");
    current = null;
    await loadSkills();
    showEmpty();
  } catch (err) {
    toast(`Delete failed: ${err.message}`, "error");
  }
});

$("#f-export").addEventListener("click", () => {
  if (!current) return;
  const url = `/api/skills/${encodeURIComponent(current)}/export`;
  window.open(url, "_blank");
});

$("#new-skill").addEventListener("click", startNew);

async function doImport(file) {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/skills/import?overwrite=1", {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || res.status);
    }
    const saved = await res.json();
    toast(`Imported '${saved.name}'`, "ok");
    await loadSkills();
    await openSkill(saved.name);
  } catch (err) {
    toast(`Import failed: ${err.message}`, "error");
  }
}

$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await doImport(file);
  e.target.value = "";
});

// Drag-and-drop anywhere on the page
const dragOverlay = $("#drag-overlay");
let dragDepth = 0;

document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  if (++dragDepth === 1) dragOverlay.classList.add("drag-active");
});
document.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    dragOverlay.classList.remove("drag-active");
  }
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", async (e) => {
  e.preventDefault();
  dragDepth = 0;
  dragOverlay.classList.remove("drag-active");
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const name = file.name.toLowerCase();
  if (!name.endsWith(".md") && !name.endsWith(".zip") && !name.endsWith(".skill")) {
    toast(`Unsupported file type: ${file.name}. Drop a .skill, .md, or .zip.`, "error");
    return;
  }
  await doImport(file);
});

$("#set-token").addEventListener("click", () => {
  const t = prompt("Admin token (leave empty to clear):", token);
  if (t === null) return;
  token = t.trim();
  if (token) localStorage.setItem("admin-token", token);
  else localStorage.removeItem("admin-token");
  toast(token ? "Token set" : "Token cleared", "ok");
});

search.addEventListener("input", () => {
  clearTimeout(search._t);
  search._t = setTimeout(loadSkills, 150);
});

loadSkills();
