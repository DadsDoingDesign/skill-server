import { buildApp } from "../src/app.js";

// Build the Express app once per cold start. Vercel's Node runtime invokes
// the default export as a (req, res) handler, and Express apps are valid
// handlers because they are themselves functions.
const app = buildApp();

export const config = {
  // Express handles body parsing internally; tell Vercel not to.
  api: { bodyParser: false },
};

export default app;
