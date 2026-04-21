require("dotenv").config();
const express = require("express");
const { connectDB } = require("./utils/db");
const profileRoutes = require("./routes/profiles");

const app = express();

// ── CORS — must be first ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send();
  next();
});

app.use(express.json());

// ── DB connection per request (Vercel serverless safe) ───────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection failed:", err);
    return res.status(500).json({ status: "error", message: "Database connection failed" });
  }
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/profiles", profileRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Insighta Labs API is running" });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// ── Local dev server ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  });
}

module.exports = app;
