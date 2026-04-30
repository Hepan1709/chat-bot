import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

// ─── Constants ───────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// Groq API endpoint
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MODEL = "llama-3.3-70b-versatile";

// Max reply length per feature (controls cost + speed)
const MAX_TOKENS = {
  chat: 500,
  summary: 300,
  content: 800,
};

// Allow requests from your frontend
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

// Parse incoming JSON request bodies automatically
app.use(express.json());

// Rate limiter: max 30 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { reply: "Too many requests. Please slow down. ⏳" },
});
app.use(limiter);

/*
callGroq()

Handles retries automatically on rate limits and server errors.
@param {Array}  messages  - [{role, content}] conversation array
@param {number} maxTokens - max length of the AI reply
@param {number} retries   - auto-retry count (default 2)
 */
async function callGroq(messages, maxTokens, retries = 2) {
  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const status = response.status;

      // 429 = Groq rate limited us — wait 2s then retry
      if (status === 429 && retries > 0) {
        console.warn("Groq rate limit hit. Retrying in 2s...");
        await new Promise((r) => setTimeout(r, 2000));
        return callGroq(messages, maxTokens, retries - 1);
      }

      // 5xx = Groq server error — retry immediately
      if (status >= 500 && retries > 0) {
        console.warn(`Groq ${status} error. Retrying...`);
        return callGroq(messages, maxTokens, retries - 1);
      }

      throw new Error(errBody?.error?.message || `Groq API error ${status}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content ?? "No response.";

    // Log token usage to track Groq usage over time
    console.log(
      `[tokens] prompt=${data.usage?.prompt_tokens} ` +
        `completion=${data.usage?.completion_tokens} ` +
        `total=${data.usage?.total_tokens}`,
    );

    return reply;
  } catch (err) {
    if (retries > 0) {
      console.warn("Network error, retrying...", err.message);
      return callGroq(messages, maxTokens, retries - 1);
    }
    throw err;
  }
}

/*
validateText()
Returns an error string if input is empty or too long.
Returns null if input is fine.
 */
function validateText(text, maxLen = 2000) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return "Text cannot be empty. ❗";
  }
  if (text.length > maxLen) {
    return `Text too long. Max ${maxLen} characters. ❗`;
  }
  return null;
}

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "AI Chatbot backend is running 🚀" });
});

// ── Chat ──────────────────────────────────────────────────
// Receives: { message: string, history: [{role, content}] }
// Returns:  { reply: string }
app.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    const err = validateText(message, 500);
    if (err) return res.status(400).json({ reply: err });

    const messages = [
      {
        role: "system",
        content:
          "You are a helpful, concise assistant. Give clear answers. Do not mention your knowledge cutoff.",
      },
      ...history,
      { role: "user", content: message },
    ];

    const reply = await callGroq(messages, MAX_TOKENS.chat);
    res.json({ reply });
  } catch (error) {
    console.error("[/chat error]", error.message);
    res.status(500).json({ reply: "Server error. Please try again. ⚠️" });
  }
});

// ── Summarize ─────────────────────────────────────────────
// Receives: { text: string }
// Returns:  { summary: string }
app.post("/summarize", async (req, res) => {
  try {
    const { text } = req.body;

    const err = validateText(text, 5000);
    if (err) return res.status(400).json({ summary: err });

    const messages = [
      {
        role: "system",
        content:
          "You are a summarization assistant. " +
          "Summarize the text the user provides into 4 to 5 clear bullet points. " +
          "Each bullet point must start with a dash (-). " +
          "Each point should be one sentence, easy to understand, and capture a key idea. " +
          "Do not include introductions, conclusions, or any text outside the bullet points. " +
          "Use plain English. Be concise and accurate.",
      },
      { role: "user", content: text },
    ];

    const summary = await callGroq(messages, MAX_TOKENS.summary);
    res.json({ summary });
  } catch (error) {
    console.error("[/summarize error]", error.message);
    res
      .status(500)
      .json({ summary: "Could not summarize. Please try again. ⚠️" });
  }
});

// ── Content Generation ────────────────────────────────────
// Receives: { prompt: string, tone?: string, type?: string }
// Returns:  { content: string }
app.post("/generate", async (req, res) => {
  try {
    const { prompt, tone = "professional", type = "paragraph" } = req.body;

    const err = validateText(prompt, 1000);
    if (err) return res.status(400).json({ content: err });

    const messages = [
      {
        role: "system",
        content: `You are a content writing assistant. Write in a ${tone} tone. Output format: ${type}. Do not add titles or explanations — just the content itself.`,
      },
      { role: "user", content: prompt },
    ];

    const content = await callGroq(messages, MAX_TOKENS.content);
    res.json({ content });
  } catch (error) {
    console.error("[/generate error]", error.message);
    res.status(500).json({ content: "Could not generate content. ⚠️" });
  }
});

// ── ADD THIS TO YOUR server.js ───────────────────────────────

// 🎨 Image Generation Route
// Receives: { prompt: string }
// Returns:  { image: base64string }
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;

    // Basic validation
    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ error: "Prompt cannot be empty ❗" });
    }

    // Call Cloudflare Workers AI
    // FLUX.2 [klein] — fast, high quality, free
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          num_steps: 4, // 4 steps = fast generation
          width: 1024,
          height: 1024,
        }),
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.log("CLOUDFLARE FULL ERROR:", JSON.stringify(err));
      throw new Error(
        err?.errors?.[0]?.message || `Cloudflare error ${response.status}`,
      );
    }

    // check if Cloudflare returned JSON or raw bytes
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Cloudflare returned JSON with base64 inside
      const data = await response.json();
      const base64 = data?.result?.image || data?.image || "";
      res.json({ image: base64 });
    } else {
      // Cloudflare returned raw image bytes — convert to base64
      const imageBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString("base64");
      res.json({ image: base64 });
    }
  } catch (error) {
    console.error("[/generate-image error]", error.message);
    res.status(500).json({ error: "Could not generate image. ⚠️" });
  }
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
