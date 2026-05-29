import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);

router.post("/start", async (req, res, next) => {
  try {
    const { subjectId, topicId, plannedMin, sessionType } = req.body;
    const { data, error } = await supabase.from("sessions")
      .insert({ user_id: req.user.id, subject_id: subjectId || null, topic_id: topicId || null, planned_min: plannedMin || 25, session_type: sessionType || "focus", started_at: new Date().toISOString() })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.post("/:id/end", async (req, res, next) => {
  try {
    const { confidenceBefore, confidenceAfter, mood, notes } = req.body;
    const endedAt = new Date();
    const { data: session } = await supabase.from("sessions").select("*").eq("id", req.params.id).single();
    const durationMin = Math.round((endedAt - new Date(session.started_at)) / 60000);
    const xpEarned = Math.min(Math.round(durationMin * 1.5), 100);
    const { data, error } = await supabase.from("sessions")
      .update({ ended_at: endedAt.toISOString(), duration_min: durationMin, confidence_before: confidenceBefore, confidence_after: confidenceAfter, mood, notes, xp_earned: xpEarned })
      .eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ session: data, xp_earned: xpEarned });
  } catch (err) { next(err); }
});

router.get("/today", async (req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase.from("sessions")
      .select("*, subjects(name, emoji, color)")
      .eq("user_id", req.user.id).gte("started_at", `${today}T00:00:00`).order("started_at");
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
