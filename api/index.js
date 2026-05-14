// Import the pre-built Express app. src/app.js exports it as the default so
// Vercel's module validator sees a function/server and doesn't crash at startup.
import app from "../src/app.js";

export default function handler(req, res) {
  return app(req, res);
}
