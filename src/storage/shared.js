export const NAME_RE = /^[a-z0-9][a-z0-9-_]{0,62}$/;

export function assertSafeName(name) {
  if (typeof name !== "string" || !NAME_RE.test(name)) {
    const err = new Error(
      "Invalid skill name. Use lowercase letters, digits, '-' or '_' (max 63 chars)."
    );
    err.status = 400;
    throw err;
  }
}

export function assertSafeRelPath(rel) {
  if (typeof rel !== "string" || !rel) {
    const err = new Error("Invalid file path");
    err.status = 400;
    throw err;
  }
  // POSIX-ish: no absolute, no traversal, no NUL.
  if (rel.startsWith("/") || rel.includes("\0") || rel.split("/").some((p) => p === "..")) {
    const err = new Error("Path traversal blocked");
    err.status = 400;
    throw err;
  }
}
