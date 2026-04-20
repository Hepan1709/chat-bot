const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Load previous chat
let messages = JSON.parse(localStorage.getItem("chat")) || [];

// Show empty state or load history
function loadChat() {
  if (messages.length === 0) {
    chatBox.innerHTML = "<p style='text-align:center;'>Start a conversation 👋</p>";
  } else {
    chatBox.innerHTML = "";
    messages.forEach(m => renderMessage(m.sender, m.text));
  }
}

window.onload = loadChat;

// Render message
function renderMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);

  const time = new Date().toLocaleTimeString();

  msg.innerHTML = `
    <div>${text}</div>
    <span class="time">${time}</span>
  `;

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Add message + save
function addMessage(sender, text) {
  if (chatBox.innerText.includes("Start a conversation")) {
    chatBox.innerHTML = "";
  }

  messages.push({ sender, text });
  localStorage.setItem("chat", JSON.stringify(messages));

  renderMessage(sender, text);
}

// Typing indicator
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot");
  typing.id = "typing";
  typing.innerHTML = "Typing<span class='dots'></span>";
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById("typing");
  if (t) t.remove();
}

// Send message
async function sendMessage() {
  const userMessage = input.value.trim();

  if (!userMessage) return;

  if (userMessage.length > 500) {
    addMessage("bot", "Message too long ❗");
    return;
  }

  addMessage("user", userMessage);
  input.value = "";

  showTyping();

  try {
    const res = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: userMessage })
    });

    const data = await res.json();

    removeTyping();
    addMessage("bot", data.reply);

  } catch (error) {
    removeTyping();
    addMessage("bot", "Error connecting to server ⚠️");
  }
}

// Events
sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});