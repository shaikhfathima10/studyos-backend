import rateLimit from "express-rate-limit";
export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  message: { error: "Too many requests." },
  standardHeaders: true, legacyHeaders: false,
});
export const aiRateLimiter = rateLimit({
  windowMs: 60000, max: 10,
  message: { error: "AI request limit reached. Wait 1 minute." },
});
