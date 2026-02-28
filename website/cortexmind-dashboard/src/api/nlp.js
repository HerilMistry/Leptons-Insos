import Groq from "groq-sdk";

const VALID_TASK_TYPES = ["Writing", "Reading", "Coding", "Watching", "Research"];

/**
 * Classifies a natural-language task description using Groq LLM.
 *
 * @param {string} userInput  — The raw text the user typed
 * @returns {Promise<{ raw_input: string, task_type: string, task_label: string, confidence: number } | null>}
 *          Returns null on any failure (caller must show error toast).
 */
export async function classifyTaskIntent(userInput) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey || apiKey === "your_groq_api_key_here") {
    return null;
  }

  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

  const systemPrompt = `You are a task classifier for a cognitive focus app.
Analyze the user's description and respond ONLY with a valid JSON object.
No explanation, no markdown, just raw JSON.
The JSON must have exactly these fields:
{
  "task_type": "one of exactly ['Writing', 'Reading', 'Coding', 'Watching', 'Research']",
  "task_label": "a short 3-5 word human readable label of what they described",
  "confidence": "a number between 0 and 1"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput },
      ],
      temperature: 0.2,
      max_tokens: 150,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";

    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/```(?:json)?/gi, "").trim();

    const parsed = JSON.parse(cleaned);

    // Validate the task_type is one of the allowed values
    if (!VALID_TASK_TYPES.includes(parsed.task_type)) {
      parsed.task_type = VALID_TASK_TYPES[0]; // fallback
    }

    return {
      raw_input: userInput,
      task_type: parsed.task_type,
      task_label: parsed.task_label ?? userInput.slice(0, 40),
      confidence: typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.8,
    };
  } catch (err) {
    return null;
  }
}
