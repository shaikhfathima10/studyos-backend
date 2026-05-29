// src/services/aiService.js
import { claude, openai, MODELS } from "../config/ai.js";

// ─────────────────────────────────────────────────────────────
// CLAUDE — Generate full weekly schedule
// Used for: complex reasoning, multi-subject scheduling
// ─────────────────────────────────────────────────────────────
export async function generateScheduleWithClaude({ profile, subjects, weekStart }) {
  const prompt = `You are an expert academic planner using habit science and spaced learning.

STUDENT PROFILE:
- Name: ${profile.name}
- Exam date: ${profile.exam_date}
- Days remaining: ${Math.ceil((new Date(profile.exam_date) - new Date()) / 86400000)}
- Daily study hours available: ${profile.daily_hours}h
- Study style: ${profile.study_style}
- Best study time: ${profile.best_time}

SUBJECTS (sorted by priority):
${subjects.map(s => `- ${s.name}: confidence ${s.confidence}%, priority ${s.priority}, studied ${s.studied_hours}h of ${s.target_hours}h target`).join("\n")}

RULES:
1. Critical/Low confidence subjects get MORE time slots
2. Use Pomodoro: 25-min focus blocks with 5-min breaks, long break every 4 sessions
3. Place hardest subject at peak energy time (match best_time preference)
4. Include daily revision of yesterday's material (15 min)
5. Saturday = catch-up + revision day
6. Sunday = rest or light review only
7. Never schedule more than 3 hours of same subject per day

Generate a 7-day schedule starting ${weekStart}.

Respond ONLY with valid JSON in this exact structure:
{
  "week": [
    {
      "date": "YYYY-MM-DD",
      "day": "Monday",
      "blocks": [
        {
          "start_time": "HH:MM",
          "duration_min": 25,
          "block_type": "study|revision|break",
          "subject_name": "Subject name or null for breaks",
          "topic_hint": "Specific topic to focus on"
        }
      ],
      "total_study_minutes": 0,
      "ai_tip": "One actionable tip for this day"
    }
  ],
  "weekly_summary": "Brief AI analysis of this week's plan"
}`;

  const response = await claude.messages.create({
    model: MODELS.claude,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text;
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json);
}

// ─────────────────────────────────────────────────────────────
// CLAUDE — Generate AI weekly progress report
// ─────────────────────────────────────────────────────────────
export async function generateWeeklyReport({ profile, subjects, sessions, currentReadiness }) {
  const totalHours = sessions.reduce((sum, s) => sum + (s.duration_min || 0) / 60, 0);
  const sessionsCount = sessions.length;

  const prompt = `You are StudyOS AI tutor analyzing a student's weekly performance.

STUDENT: ${profile.name}
EXAM IN: ${Math.ceil((new Date(profile.exam_date) - new Date()) / 86400000)} days
GOAL: ${profile.goal}

WEEK STATS:
- Total hours studied: ${totalHours.toFixed(1)}h
- Sessions completed: ${sessionsCount}
- Current readiness: ${currentReadiness}%

SUBJECT CONFIDENCE:
${subjects.map(s => `- ${s.name}: ${s.confidence}% (${s.priority} priority)`).join("\n")}

Write a motivating but honest weekly report. Be specific, data-driven, and encouraging.
Address each critical subject directly. Give 3 concrete action items for next week.

Respond in JSON:
{
  "headline": "One punchy headline about the week",
  "summary": "2-3 sentence overall assessment",
  "wins": ["win1", "win2"],
  "concerns": ["concern1"],
  "next_week_actions": ["action1", "action2", "action3"],
  "readiness_prediction": 65,
  "motivational_message": "One personal, specific motivational message"
}`;

  const response = await claude.messages.create({
    model: MODELS.claude,
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text;
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─────────────────────────────────────────────────────────────
// OPENAI — Fast confidence analysis after session
// Used for: quick post-session feedback (cheaper, faster)
// ─────────────────────────────────────────────────────────────
export async function analyzeSessionWithOpenAI({ subject, topic, duration, confidenceBefore, confidenceAfter, mood, notes }) {
  const completion = await openai.chat.completions.create({
    model: MODELS.openai,
    max_tokens: 300,
    messages: [{
      role: "system",
      content: "You are a study coach. Respond only in JSON."
    }, {
      role: "user",
      content: `Student just finished a ${duration}-min session on ${subject} (${topic || "general"}).
Confidence: ${confidenceBefore}% → ${confidenceAfter}%
Mood: ${mood || "not reported"}
Notes: ${notes || "none"}

Respond with:
{
  "feedback": "2-sentence specific feedback",
  "next_focus": "What to study next in this subject",
  "xp_bonus": 0,
  "encouragement": "Short motivational line"
}`
    }]
  });

  const text = completion.choices[0].message.content;
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─────────────────────────────────────────────────────────────
// OPENAI — Extract topics from pasted syllabus text
// ─────────────────────────────────────────────────────────────
export async function extractTopicsFromSyllabus({ subjectName, syllabusText }) {
  const completion = await openai.chat.completions.create({
    model: MODELS.openai,
    max_tokens: 600,
    messages: [{
      role: "system",
      content: "Extract study topics from syllabus text. Respond only in JSON."
    }, {
      role: "user",
      content: `Subject: ${subjectName}
Syllabus:
${syllabusText.slice(0, 2000)}

Extract the main topics. Respond:
{
  "topics": ["Topic 1", "Topic 2", ...],
  "estimated_difficulty": "easy|medium|hard",
  "suggested_hours": 20
}`
    }]
  });

  const text = completion.choices[0].message.content;
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─────────────────────────────────────────────────────────────
// CLAUDE — Exam readiness prediction
// ─────────────────────────────────────────────────────────────
export async function predictExamReadiness({ profile, subjects, recentSessions }) {
  const avgConfidence = subjects.reduce((s, sub) => s + sub.confidence, 0) / subjects.length;
  const daysLeft = Math.ceil((new Date(profile.exam_date) - new Date()) / 86400000);
  const hoursPerDay = recentSessions.reduce((s, sess) => s + (sess.duration_min || 0) / 60, 0) / 7;

  // Weighted formula: confidence (60%) + pace (25%) + time buffer (15%)
  const paceScore = Math.min((hoursPerDay / profile.daily_hours) * 100, 100);
  const timeBuffer = Math.min((daysLeft / 30) * 100, 100);
  const rawReadiness = avgConfidence * 0.6 + paceScore * 0.25 + timeBuffer * 0.15;

  return {
    readiness: Math.round(Math.min(rawReadiness, 99)),
    breakdown: {
      confidence_score: Math.round(avgConfidence),
      pace_score: Math.round(paceScore),
      time_buffer_score: Math.round(timeBuffer),
    },
    critical_subjects: subjects.filter(s => s.confidence < 50).map(s => s.name),
  };
}