//  script.js  –  Frontend Chat Logic
//  Uses apiService.js for all backend calls.

const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const summarizeBtn = document.getElementById("summarize-btn");

// ─── Chat History ────────────────────────────────────────────
let messages = JSON.parse(localStorage.getItem("chat")) || [];

// ─── Load Previous Chat on Page Open ───────────────────────── 
function loadChat() {
  if (messages.length === 0) {
    chatBox.innerHTML = "<p style='text-align:center;color:#999'>Start a conversation 👋</p>";
  } else {
    chatBox.innerHTML = "";
    messages.forEach(m => renderMessage(m.sender, m.text, m.time));
  }
}
window.onload = loadChat;

// ─── Render One Message on Screen ────────────────────────────
function renderMessage(sender, text, time = new Date().toLocaleTimeString()) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = `<div>${text}</div><span class="time">${time}</span>`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ─── Add Message + Save to localStorage ──────────────────────
function addMessage(sender, text) {
  if (chatBox.innerText.includes("Start a conversation")) {
    chatBox.innerHTML = "";
  }
  const time = new Date().toLocaleTimeString();
  messages.push({ sender, text, time });
  localStorage.setItem("chat", JSON.stringify(messages));
  renderMessage(sender, text, time);
}

// ─── Typing Indicator ─────────────────────────────────────────
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot");
  typing.id        = "typing";
  typing.innerHTML = "Typing<span class='dots'></span>";
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;
}
function removeTyping() {
  document.getElementById("typing")?.remove();
}

// ─── Convert History for Groq API ────────────────────────────
function getApiHistory() {
  return messages.map(m => ({
    role:    m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

// Prevents user from clicking Send AND Summarize at the same time
function setLoading(isLoading) {
  sendBtn.disabled      = isLoading;
  summarizeBtn.disabled = isLoading;
}

// ─── Send Chat Message ────────────────────────────────────────
async function sendMessage() {
  const userMessage = input.value.trim();
  if (!userMessage) return;

  if (userMessage.length > 500) {
    addMessage("bot", "Message too long. Max 500 characters. ❗");
    return;
  }

  addMessage("user", userMessage);
  input.value = "";
  setLoading(true);
  showTyping();

  try {
    const reply = await sendChatMessage(userMessage, getApiHistory());
    removeTyping();
    addMessage("bot", reply);
  } catch (error) {
    removeTyping();
    addMessage("bot", error.message);
  } finally {
    setLoading(false);
  }
}

// ─── Summarize ────────────────────────────────────────────────
async function handleSummarize() {
  const userText = input.value.trim();

  // Empty input
  if (!userText) {
    addMessage("bot", "Please paste some text first to summarize. ❗");
    return;
  }

  // Too short — not worth summarizing
  if (userText.length < 100) {
    addMessage("bot", "Text is too short to summarize. Please paste at least 100 characters. ❗");
    return;
  }

  // Too long — exceeds /summarize route limit
  if (userText.length > 5000) {
    addMessage("bot", "Text is too long. Please keep it under 5000 characters. ❗");
    return;
  }

  // Show a short preview of what the user asked to summarize
  // Slices first 60 chars so the message bubble doesn't overflow
  addMessage("user", `Summarize: "${userText.slice(0, 60)}..."`);
  input.value = "";
  setLoading(true);
  showTyping();

  try {
    const summary = await summarizeText(userText);
    removeTyping();

    // Clean up and format each line of the summary
    const formatted = summary
      .split("\n")
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-•*]\s*/, "• "))
      .join("<br>");

    addMessage("bot", `📋 <strong>Summary:</strong><br><br>${formatted}`);

  } catch (error) {
    removeTyping();
    addMessage("bot", error.message);
  } finally {
    setLoading(false);
  }
}

// ─── Event Listeners ──────────────────────────────────────────
sendBtn.addEventListener("click", sendMessage);
summarizeBtn.addEventListener("click", handleSummarize);

// Enter key only triggers Send, not Summarize
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});