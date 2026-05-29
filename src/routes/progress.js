import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);

router.get("/readiness", async (req, res, next) => {
  try {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", req.user.id).single();
    const { data: subjects } = await supabase.from("subjects").select("*").eq("user_id", req.user.id);
    const subjectList = subjects || [];
    const avgConfidence = subjectList.length
      ? subjectList.reduce((s, sub) => s + (sub.confidence || 50), 0) / subjectList.length
      : 50;
    const examDate = profile?.exam_date ? new Date(profile.exam_date) : new Date(Date.now() + 30 * 86400000);
    const daysLeft = Math.max(Math.ceil((examDate - new Date()) / 86400000), 1);
    const timeBuffer = Math.min((daysLeft / 30) * 100, 100);
    const readiness = Math.round(Math.min(avgConfidence * 0.7 + timeBuffer * 0.3, 99));
    res.json({
      readiness,
      breakdown: {
        confidence_score: Math.round(avgConfidence),
        time_buffer_score: Math.round(timeBuffer),
      },
      critical_subjects: subjectList.filter(s => s.confidence < 50).map(s => s.name),
    });
  } catch (err) { next(err); }
});

router.get("/weekly-report", async (req, res, next) => {
  try {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", req.user.id).single();
    const { data: subjects } = await supabase.from("subjects").select("*").eq("user_id", req.user.id);
    res.json({
      headline: "Keep pushing forward!",
      summary: "You are making great progress. Stay consistent and keep studying!",
      wins: ["Consistent study sessions", "Good subject coverage"],
      concerns: (subjects || []).filter(s => s.confidence < 50).map(s => `${s.name} needs more attention`),
      next_week_actions: ["Focus on weak subjects", "Review past sessions", "Take practice tests"],
      readiness_prediction: 65,
      motivational_message: "Every expert was once a beginner. Keep going!",
    });
  } catch (err) { next(err); }
});

router.get("/history", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("readiness_snapshots").select("*").eq("user_id", req.user.id).order("snapshot_date").limit(30);
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

export default router;
