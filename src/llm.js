const BASE_URL = "http://localhost:11434";
const MODEL = "ibm/granite4:7b-a1b-h";

export async function chat(messages, systemPrompt) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [{ role: "system", content: systemPrompt }, ...messages]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.message.content;
}

export function buildSchedulePrompt(weekStartDate) {

  const exampleStart = new Date(weekStartDate);
  exampleStart.setHours(9, 0, 0, 0);

  const exampleEnd = new Date(weekStartDate);
  exampleEnd.setHours(10, 0, 0, 0);

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  function formatLocalDateTime(date) {
    const pad = n => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
    }

  return `You are a scheduling engine. Based on the conversation above, produce a weekly schedule as a JSON array.

    Week start date: ${formatLocalDateTime(weekStartDate)}
    Week end date: ${formatLocalDateTime(weekEndDate)}

    Every event must start on or after ${formatLocalDateTime(weekStartDate)}.
    Every event must end on or before ${formatLocalDateTime(weekEndDate)}.
    Assume all events are taking place in ${timeZone}.

    Output ONLY a valid JSON array. No markdown fences, no explanation, no preamble.

    Each event must follow this exact shape:
    {
    "id": 1,
    "title": "Short event title",
    "description": "Optional detail or empty string",
    "start": "${formatLocalDateTime(exampleStart)}",
    "end": "${formatLocalDateTime(exampleEnd)}",
    "isAllDay": false
    }

    Rules:
    - Return only JSON.
    - Use lowercase field names exactly: id, title, description, start, end, isAllDay.
    - start and end must be local ISO date-time strings with no timezone suffix.
    - Example: "2026-06-01T08:30:00"
    - Do not include Z or timezone offsets.
    - Do not use date-only values.
    - Do not use dates outside the week start/end range above.
    - Do not overlap events on the same day.
    - Reflect the user's non-negotiables, tasks, and preferences.
    - If the user mentioned a recurring event, create one event per occurrence.
    - If the user does not specify times, use realistic durations: meetings 30–60 min, deep work 90–120 min, meals 30 min.
    - Create unique integer ids starting at 1.`;
}

export async function generateSchedule(conversationHistory) {
  const weekStart = new Date();
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const prompt = buildSchedulePrompt(weekStart);
  const raw = await chat(conversationHistory, prompt);

  const clean = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(clean);

  const events = parsed
    .map((event, index) => {
      const start = new Date(event.start);
      const end = new Date(event.end);

      return {
        id: event.id ?? index + 1,
        title: event.title ?? "Untitled",
        description: event.description ?? "",
        start,
        end,
        isAllDay: Boolean(event.isAllDay)
      };
    })

    .filter(event =>
      !isNaN(event.start.getTime()) &&
      !isNaN(event.end.getTime()) &&
      event.end > event.start &&
      event.start >= weekStart &&
      event.end < weekEnd
    );

  console.log("Normalized scheduler events:", events);

  return events;
}