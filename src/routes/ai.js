import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimiter } from "../middleware/rateLimiter.js";
import { extractTopicsFromSyllabus } from "../services/aiService.js";
const router = Router();
router.use(requireAuth);
router.use(aiRateLimiter);

router.post("/extract-topics", async (req, res, next) => {
  try {
    const { subjectName, syllabusText } = req.body;
    if (!subjectName || !syllabusText) return res.status(400).json({ error: "subjectName and syllabusText required" });
    const result = await extractTopicsFromSyllabus({ subjectName, syllabusText });
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
