import { buildApp } from "../src/app.js";

// Build the Express app once per cold start.
const app = buildApp();

// Vercel's Node Runtime v3 expects a plain default-export handler function.
// `export const config` is a Next.js-only pattern; using it in a non-Next.js
// function causes "Invalid export found in module" at cold-start and crashes
// every request. Vercel does not pre-parse request bodies for plain functions,
// so Express's own body parsers work without any extra config.
export default function handler(req, res) {
  return app(req, res);
}
