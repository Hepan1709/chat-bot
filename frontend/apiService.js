//  apiService.js  –  Frontend API Service Layer
//  ALL backend calls go through this file.


// Backend URL
const BASE_URL = "http://localhost:3000";

/*
 Handles every request to the backend.
 Adds: JSON headers, 15s timeout, and clean error messages.
 
  @param {string} endpoint  - e.g. "/chat", "/summarize", "/generate"
  @param {object} body      - data to send as JSON
  @returns {object}         - parsed JSON response from server
 */
async function apiFetch(endpoint, body) {
  // AbortController cancels the request if it takes over 15 seconds
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json().catch(() => null);

    // Server returned an error (400, 500, etc.)
    if (!response.ok) {
      const msg = data?.reply || data?.summary || data?.content || "An error occurred.";
      throw new Error(msg);
    }

    return data;

  } catch (err) {
    clearTimeout(timeout);

    // Our 15 second timer fired
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Server may be slow. ⏳");
    }

    // Server is completely unreachable
    if (err.message === "Failed to fetch") {
      throw new Error("Cannot reach server. Is it running? ⚠️");
    }

    throw err;
  }
}

// ─── Chat ─────────────────────────────────────────
/* sendChatMessage()
 Sends a user message + full history to /chat.

@param {string} message  - what the user just typed
@param {Array}  history  - previous messages in OpenAI format
@returns {string}        - the bot's reply
 */
async function sendChatMessage(message, history = []) {
  const data = await apiFetch("/chat", { message, history });
  return data.reply;
}

// ─── Summarize ─────────────────────────────────────
/*
 summarizeText()
 Sends text to /summarize, returns bullet point summary.
 @param {string} text  - the text to summarize
 @returns {string}     - summary as bullet points
 */
async function summarizeText(text) {
  const data = await apiFetch("/summarize", { text });
  return data.summary;
}

// ─── Content Generation ─────────────────────────────────────
/*
 generateContent()
 Sends a prompt to /generate, returns written content.
 @param {string} prompt  - what to write about
 @param {string} tone    - "professional" | "casual" | "formal"
 @param {string} type    - "paragraph" | "email" | "bullet points"
 @returns {string}       - the generated content
 */
async function generateContent(prompt, tone = "professional", type = "paragraph") {
  const data = await apiFetch("/generate", { prompt, tone, type });
  return data.content;
}