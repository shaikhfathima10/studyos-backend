import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/start", async (req, res, next) => {
  try {
    const { subjectId, topicId, plannedMin, sessionType } = req.body;
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: req.user.id,
        subject_id: subjectId || null,
        topic_id: topicId || null,
        planned_min: plannedMin || 25,
        session_type: sessionType || "focus",
        started_at: new Date().toISOString(),
      }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.post("/:id/end", async (req, res, next) => {
  try {
    const { confidenceBefore, confidenceAfter, mood, notes } = req.body;
    const endedAt = new Date();

    const { data: session, error: fetchErr } = await supabase
      .from("sessions").select("*").eq("id", req.params.id).single();
    if (fetchErr) throw fetchErr;

    const durationMin = Math.round((endedAt - new Date(session.started_at)) / 60000);
    const xpEarned = Math.min(Math.round(durationMin * 2), 100);

    const { data, error } = await supabase
      .from("sessions")
      .update({
        ended_at: endedAt.toISOString(),
        duration_min: durationMin,
        confidence_before: confidenceBefore || null,
        confidence_after: confidenceAfter || null,
        mood: mood || null,
        notes: notes || null,
        xp_earned: xpEarned,
      })
      .eq("id", req.params.id).select().single();
    if (error) throw error;

    // Update streak
    const today = new Date().toISOString().split("T")[0];
    const { data: profile } = await supabase
      .from("profiles").select("last_studied, streak, longest_streak")
      .eq("id", req.user.id).single();

    let newStreak = profile?.streak || 0;
    const lastStudied = profile?.last_studied;

    if (lastStudied === today) {
      // Already studied today — no change
    } else if (lastStudied === new Date(Date.now() - 86400000).toISOString().split("T")[0]) {
      // Studied yesterday — increment streak
      newStreak = newStreak + 1;
      await supabase.from("profiles").update({
        streak: newStreak,
        longest_streak: Math.max(profile?.longest_streak || 0, newStreak),
        last_studied: today,
        xp: supabase.rpc ? undefined : undefined,
      }).eq("id", req.user.id);
    } else {
      // Streak broken — reset to 1
      newStreak = 1;
      await supabase.from("profiles").update({
        streak: 1,
        last_studied: today,
      }).eq("id", req.user.id);
    }

    // Award XP
    const { data: currentProfile } = await supabase
      .from("profiles").select("xp, level").eq("id", req.user.id).single();

    const newXp = (currentProfile?.xp || 0) + xpEarned;
    const newLevel = Math.floor(newXp / 500) + 1;

    await supabase.from("profiles").update({
      xp: newXp,
      level: newLevel,
      streak: newStreak,
      last_studied: today,
    }).eq("id", req.user.id);

    // Update studied_hours for subject
    if (session.subject_id) {
      const { data: subject } = await supabase
        .from("subjects").select("studied_hours").eq("id", session.subject_id).single();
      await supabase.from("subjects").update({
        studied_hours: (subject?.studied_hours || 0) + (durationMin / 60),
      }).eq("id", session.subject_id);
    }

    // Award first session badge
    try {
      const { data: badge } = await supabase
        .from("badges").select("id").eq("key", "first_session").single();
      if (badge) {
        await supabase.from("user_badges")
          .insert({ user_id: req.user.id, badge_id: badge.id })
          .onConflict("user_id, badge_id").ignore();
      }
    } catch {}

    // Check 7 day streak badge
    if (newStreak >= 7) {
      try {
        const { data: badge } = await supabase
          .from("badges").select("id").eq("key", "seven_streak").single();
        if (badge) {
          await supabase.from("user_badges")
            .insert({ user_id: req.user.id, badge_id: badge.id })
            .onConflict("user_id, badge_id").ignore();
        }
      } catch {}
    }

    res.json({ session: data, xp_earned: xpEarned, new_streak: newStreak, new_xp: newXp });
  } catch (err) { next(err); }
});

router.get("/today", async (req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("sessions")
      .select("*, subjects(name, emoji, color)")
      .eq("user_id", req.user.id)
      .gte("started_at", `${today}T00:00:00`)
      .order("started_at");
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

export default router;