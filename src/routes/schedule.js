import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("schedule_blocks")
      .select("*, subjects(name, emoji, color), topics(name)")
      .eq("user_id", req.user.id)
      .eq("scheduled_date", date)
      .order("start_time");
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

router.post("/generate", async (req, res, next) => {
  try {
    const weekStart = req.body.weekStart || new Date().toISOString().split("T")[0];

    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", req.user.id).single();

    const { data: subjects } = await supabase
      .from("subjects").select("*")
      .eq("user_id", req.user.id)
      .order("confidence", { ascending: true });

    if (!subjects?.length)
      return res.status(400).json({ error: "Add at least one subject first" });

    console.log("Subjects found:", subjects.map(s => s.name));

    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 7);

    await supabase.from("schedule_blocks").delete()
      .eq("user_id", req.user.id)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", endDate.toISOString().split("T")[0]);

    const blocks = [];
    const dailyHours = profile?.daily_hours || 4;
    const sessionsPerDay = Math.max(Math.floor(dailyHours / 1.5), subjects.length);
    let subjectIndex = 0;

    for (let day = 0; day < 7; day++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + day);
      if (date.getDay() === 0) continue;
      const dateStr = date.toISOString().split("T")[0];
      let hour = 8;

      for (let i = 0; i < sessionsPerDay; i++) {
        const subject = subjects[subjectIndex % subjects.length];
        subjectIndex++;

        blocks.push({
          user_id: req.user.id,
          subject_id: subject.id,
          scheduled_date: dateStr,
          start_time: String(hour).padStart(2, "0") + ":00",
          duration_min: 50,
          block_type: "study",
          status: "pending",
          ai_generated: false,
        });
        hour++;

        blocks.push({
          user_id: req.user.id,
          subject_id: null,
          scheduled_date: dateStr,
          start_time: String(hour).padStart(2, "0") + ":00",
          duration_min: 10,
          block_type: "break",
          status: "pending",
          ai_generated: false,
        });
        hour++;
      }
    }

    await supabase.from("schedule_blocks").insert(blocks);

    console.log("Generated", blocks.length, "blocks for", subjects.length, "subjects");

    res.json({
      message: "Schedule generated!",
      total_blocks: blocks.length,
      subjects: subjects.map(s => s.name)
    });
  } catch (err) { next(err); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from("schedule_blocks")
      .update({ status })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
