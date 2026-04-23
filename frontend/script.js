// ============================================================
//  script.js  –  Frontend Chat Logic
//  Uses apiService.js for all backend calls.
//  Never call fetch() directly here.
// ============================================================

const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// ─── Chat History ─────────────────────────────────────────────
// Load saved messages from localStorage, or start with empty array
let messages = JSON.parse(localStorage.getItem("chat")) || [];

// ─── Load Previous Chat on Page Open ─────────────────────────
function loadChat() {
  if (messages.length === 0) {
    chatBox.innerHTML =
      "<p style='text-align:center;color:#999'>Start a conversation 👋</p>";
  } else {
    chatBox.innerHTML = "";
    // Pass saved timestamp so old messages show correct time
    messages.forEach((m) => renderMessage(m.sender, m.text, m.time));
  }
}
window.onload = loadChat;

// ─── Render One Message on Screen ────────────────────────────
// time defaults to right now — only for brand new messages
function renderMessage(sender, text, time = new Date().toLocaleTimeString()) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = `<div>${text}</div><span class="time">${time}</span>`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; // auto scroll to bottom
}

// ─── Add Message + Save to localStorage ──────────────────────
function addMessage(sender, text) {
  // Clear the welcome placeholder on first message
  if (chatBox.innerText.includes("Start a conversation")) {
    chatBox.innerHTML = "";
  }

  const time = new Date().toLocaleTimeString(); // save REAL time now
  messages.push({ sender, text, time });
  localStorage.setItem("chat", JSON.stringify(messages));
  renderMessage(sender, text, time);
}

// ─── Typing Indicator ─────────────────────────────────────────
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot");
  typing.id = "typing";
  typing.innerHTML = "Typing<span class='dots'></span>";
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

// ─── Convert History for Groq API ────────────────────────────
// localStorage format:  { sender: "user", text: "hi", time: "..." }
// Groq API format:      { role: "user", content: "hi" }
function getApiHistory() {
  return messages.map((m) => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

// ─── Send Message ─────────────────────────────────────────────
async function sendMessage() {
  const userMessage = input.value.trim();

  if (!userMessage) return;

  if (userMessage.length > 500) {
    addMessage("bot", "Message too long. Max 500 characters. ❗");
    return;
  }

  addMessage("user", userMessage);
  input.value = "";
  sendBtn.disabled = true; // prevent double-send while waiting

  showTyping();

  try {
    // Use apiService.js — NOT raw fetch()
    const reply = await sendChatMessage(userMessage, getApiHistory());

    removeTyping();
    addMessage("bot", reply);
  } catch (error) {
    removeTyping();
    // error.message comes from apiService error handling
    addMessage("bot", error.message);
  } finally {
    // Always re-enable button whether success or error
    sendBtn.disabled = false;
  }
}

// ─── Event Listeners ──────────────────────────────────────────
sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
