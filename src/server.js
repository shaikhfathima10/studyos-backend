import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { validateEnv } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import authRoutes     from "./routes/auth.js";
import subjectRoutes  from "./routes/subjects.js";
import scheduleRoutes from "./routes/schedule.js";
import sessionRoutes  from "./routes/sessions.js";
import aiRoutes       from "./routes/ai.js";
import progressRoutes from "./routes/progress.js";
import rewardsRoutes  from "./routes/rewards.js";

validateEnv();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use(rateLimiter);

app.get("/health", (_, res) => res.json({
  status: "ok",
  service: "StudyOS API",
  timestamp: new Date().toISOString()
}));

app.use("/api/auth",     authRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/ai",       aiRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/rewards",  rewardsRoutes); 

app.get("/test", (req, res) => {
  res.json({
    message: "Server working perfectly 🚀"
  });
});

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n?? StudyOS API ? http://localhost:${PORT}`);
  console.log(`?? Mode: ${process.env.NODE_ENV}`);
  console.log(`?? AI: Claude + OpenAI`);
  console.log(`???  DB: Supabase\n`);
});
