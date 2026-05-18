let token = localStorage.getItem("admin-token") || "";

export function getToken() {
  return token;
}

export function setToken(t) {
  token = (t || "").trim();
  if (token) localStorage.setItem("admin-token", token);
  else localStorage.removeItem("admin-token");
}

function authHeaders(extra = {}) {
  const h = { ...extra };
  if (token) h["X-Admin-Token"] = token;
  return h;
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...(opts.headers || {}), ...authHeaders() },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const ctype = res.headers.get("content-type") || "";
  return ctype.includes("application/json") ? res.json() : res.blob();
}

export async function uploadImport(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/skills/import?overwrite=1", {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || res.status);
  }
  return res.json();
}
