import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth);

router.get("/badges", async (req, res, next) => {
  try {
    const { data: all } = await supabase.from("badges").select("*");
    const { data: earned } = await supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", req.user.id);
    const earnedIds = new Set(earned?.map(e => e.badge_id));
    res.json(all?.map(b => ({ ...b, earned: earnedIds.has(b.id), earned_at: earned?.find(e => e.badge_id === b.id)?.earned_at || null })));
  } catch (err) { next(err); }
});

router.get("/streak", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("profiles").select("streak, longest_streak, xp, level, last_studied").eq("id", req.user.id).single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
