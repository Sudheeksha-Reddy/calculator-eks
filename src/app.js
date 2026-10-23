import express from "express";
import { add, divide } from "./calculator.js";

export const app = express();

// Kubernetes calls this to check the app is alive
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Shows which version is running (set by the pipeline later)
app.get("/version", (req, res) => {
  res.json({ version: process.env.APP_VERSION || "dev" });
});

function readNumbers(req, res) {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    res.status(400).json({ error: "a and b must be numbers" });
    return null;
  }
  return { a, b };
}

app.get("/add", (req, res) => {
  const n = readNumbers(req, res);
  if (n) res.json({ result: add(n.a, n.b) });
});

app.get("/divide", (req, res) => {
  const n = readNumbers(req, res);
  if (!n) return;
  try {
    res.json({ result: divide(n.a, n.b) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
