import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("subjects").select("*, topics(*)")
      .eq("user_id", req.user.id).order("created_at");
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, emoji, color, targetHours, topics: topicNames } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const { data: subject, error } = await supabase
      .from("subjects")
      .insert({ user_id: req.user.id, name, emoji: emoji || "📚", color: color || "#6C63FF", target_hours: targetHours || 20 })
      .select().single();
    if (error) throw error;
    if (topicNames?.length) {
      await supabase.from("topics").insert(
        topicNames.map((t) => ({ subject_id: subject.id, user_id: req.user.id, name: t }))
      );
    }
    const { data: full } = await supabase
      .from("subjects").select("*, topics(*)").eq("id", subject.id).single();
    res.status(201).json(full);
  } catch (err) { next(err); }
});

router.patch("/:id/confidence", async (req, res, next) => {
  try {
    const { confidence, topicId } = req.body;
    if (confidence == null) return res.status(400).json({ error: "confidence is required" });
    const { data, error } = await supabase
      .from("subjects")
      .update({ confidence, updated_at: new Date().toISOString() })
      .eq("id", req.params.id).eq("user_id", req.user.id).select().single();
    if (error) throw error;
    await supabase.from("confidence_history").insert({
      user_id: req.user.id, subject_id: req.params.id,
      topic_id: topicId || null, confidence,
    });
    res.json(data);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabase
      .from("subjects").delete()
      .eq("id", req.params.id).eq("user_id", req.user.id);
    if (error) throw error;
    res.json({ message: "Subject deleted" });
  } catch (err) { next(err); }
});

export default router;