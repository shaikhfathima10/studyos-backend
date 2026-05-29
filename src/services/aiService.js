import { claude, openai, MODELS } from "../config/ai.js";

export async function generateScheduleWithClaude({ profile, subjects, weekStart }) {
  const prompt = `You are an expert academic planner. Generate a 7-day study schedule.
STUDENT: ${profile.name} | EXAM: ${profile.exam_date} | DAILY HOURS: ${profile.daily_hours}h
SUBJECTS: ${subjects.map(s => `${s.name}: ${s.confidence}% confidence, ${s.priority} priority`).join(", ")}
RULES: Critical subjects get more slots. Use 25min pomodoro blocks. Max 3h same subject/day. Sunday = rest.
Generate from ${weekStart}. Respond ONLY in JSON:
{"week":[{"date":"YYYY-MM-DD","day":"Monday","blocks":[{"start_time":"HH:MM","duration_min":25,"block_type":"study","subject_name":"Physics","topic_hint":"topic"}],"total_study_minutes":0,"ai_tip":"tip"}],"weekly_summary":"summary"}`;
  const response = await claude.messages.create({ model: MODELS.claude, max_tokens: 4000, messages: [{ role: "user", content: prompt }] });
  return JSON.parse(response.content[0].text.replace(/```json|```/g, "").trim());
}

export async function generateWeeklyReport({ profile, subjects, sessions, currentReadiness }) {
  const totalHours = sessions.reduce((s, sess) => s + (sess.duration_min || 0) / 60, 0);
  const prompt = `StudyOS AI weekly report for ${profile.name}. Exam in ${Math.ceil((new Date(profile.exam_date) - new Date()) / 86400000)} days. Readiness: ${currentReadiness}%. Hours: ${totalHours.toFixed(1)}h. Subjects: ${subjects.map(s => `${s.name} ${s.confidence}%`).join(", ")}. Respond in JSON: {"headline":"","summary":"","wins":[],"concerns":[],"next_week_actions":[],"readiness_prediction":65,"motivational_message":""}`;
  const response = await claude.messages.create({ model: MODELS.claude, max_tokens: 1000, messages: [{ role: "user", content: prompt }] });
  return JSON.parse(response.content[0].text.replace(/```json|```/g, "").trim());
}

export async function analyzeSessionWithOpenAI({ subject, duration, confidenceBefore, confidenceAfter, mood, notes }) {
  const completion = await openai.chat.completions.create({
    model: MODELS.openai, max_tokens: 300,
    messages: [
      { role: "system", content: "You are a study coach. Respond only in JSON." },
      { role: "user", content: `${duration}min session on ${subject}. Confidence: ${confidenceBefore}%?${confidenceAfter}%. Mood: ${mood}. Respond: {"feedback":"","next_focus":"","xp_bonus":0,"encouragement":""}` }
    ],
  });
  return JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, "").trim());
}

export async function extractTopicsFromSyllabus({ subjectName, syllabusText }) {
  const completion = await openai.chat.completions.create({
    model: MODELS.openai, max_tokens: 600,
    messages: [
      { role: "system", content: "Extract study topics from syllabus. Respond only in JSON." },
      { role: "user", content: `Subject: ${subjectName}\n${syllabusText.slice(0,2000)}\nRespond: {"topics":[],"estimated_difficulty":"medium","suggested_hours":20}` }
    ],
  });
  return JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, "").trim());
}

export async function predictExamReadiness({ profile, subjects, recentSessions }) {
  const avgConfidence = subjects.length ? subjects.reduce((s, sub) => s + sub.confidence, 0) / subjects.length : 50;
  const daysLeft = Math.ceil((new Date(profile.exam_date) - new Date()) / 86400000);
  const hoursPerDay = recentSessions.length ? recentSessions.reduce((s, sess) => s + (sess.duration_min || 0) / 60, 0) / 7 : 0;
  const paceScore = Math.min((hoursPerDay / (profile.daily_hours || 4)) * 100, 100);
  const timeBuffer = Math.min((daysLeft / 30) * 100, 100);
  return {
    readiness: Math.round(Math.min(avgConfidence * 0.6 + paceScore * 0.25 + timeBuffer * 0.15, 99)),
    breakdown: { confidence_score: Math.round(avgConfidence), pace_score: Math.round(paceScore), time_buffer_score: Math.round(timeBuffer) },
    critical_subjects: subjects.filter(s => s.confidence < 50).map(s => s.name),
  };
}
