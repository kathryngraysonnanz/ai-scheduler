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

  return `You are a scheduling engine. Based on the conversation above, produce a weekly schedule as a JSON array.

Week start date: ${weekStartDate.toISOString()}
Week end date: ${weekEndDate.toISOString()}

Every event must start on or after ${weekStartDate.toISOString()}.
Every event must end on or before ${weekEndDate.toISOString()}.

Output ONLY a valid JSON array. No markdown fences, no explanation, no preamble.

Each event must follow this exact shape:
{
  "id": 1,
  "title": "Short event title",
  "description": "Optional detail or empty string",
  "start": "${exampleStart.toISOString()}",
  "end": "${exampleEnd.toISOString()}",
  "isAllDay": false
}

Rules:
- Return only JSON.
- Use lowercase field names exactly: id, title, description, start, end, isAllDay.
- start and end must be ISO 8601 date-time strings.
- Do not use date-only values.
- Do not use dates outside the week start/end range above.
- Do not overlap events on the same day.
- Reflect the user's non-negotiables, tasks, and preferences.
- If the user mentioned a recurring event, create one event per occurrence.
- Use realistic durations: meetings 30–60 min, deep work 90–120 min, meals 30 min.
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

  console.log("Calculated weekStart:", weekStart.toString(), weekStart.toISOString());
  console.log("Calculated weekEnd:", weekEnd.toString(), weekEnd.toISOString());

  const prompt = buildSchedulePrompt(weekStart);
  const raw = await chat(conversationHistory, prompt);

  console.log("Raw schedule response:", raw);

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