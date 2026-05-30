console.log("Starting server");
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { validateEnv } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimiter } from "./middleware/rateLimiter.js";

// Routes
import authRoutes     from "./routes/auth.js";
import subjectRoutes  from "./routes/subjects.js";
import scheduleRoutes from "./routes/schedule.js";
import sessionRoutes  from "./routes/sessions.js";
import aiRoutes       from "./routes/ai.js";
import progressRoutes from "./routes/progress.js";
import rewardsRoutes  from "./routes/rewards.js";

// Validate all env vars on startup
validateEnv();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Core Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(rateLimiter);

// ─── Health Check ────────────────────────────────────────────
app.get("/health", (_, res) => res.json({
  status: "ok",
  service: "StudyOS API",
  version: "1.0.0",
  timestamp: new Date().toISOString()
}));

// ─── API Routes ───────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/ai",       aiRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/rewards",  rewardsRoutes);

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 StudyOS API running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`🤖 AI: Claude + OpenAI`);
  console.log(`🗄️  DB: Supabase\n`);
});

export default app;