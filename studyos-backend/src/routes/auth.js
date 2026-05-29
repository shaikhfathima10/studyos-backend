import { Router } from "express";
import { supabase, supabaseAuth } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, goal, examDate, dailyHours } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: "email, password, and name are required" });
    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({ email, password });
    if (authError) return res.status(400).json({ error: authError.message });
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({ id: authData.user.id, name, goal, exam_date: examDate, daily_hours: dailyHours || 4 })
      .select().single();
    if (profileError) return res.status(400).json({ error: profileError.message });
    res.status(201).json({
      message: "Account created",
      user: { id: authData.user.id, email, name },
      session: authData.session,
    });
  } catch (err) { next(err); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: "Invalid credentials" });
    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", data.user.id).single();
    res.json({ user: { ...data.user, profile }, session: data.session });
  } catch (err) { next(err); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*, subjects(*), user_badges(*, badges(*))")
      .eq("id", req.user.id).single();
    if (error) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) { next(err); }
});

router.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const allowed = ["name","goal","exam_date","daily_hours","study_style","best_time"];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("profiles").update(updates).eq("id", req.user.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) { next(err); }
});

export default router;