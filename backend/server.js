import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

//  In-memory chat history (session)
let chatHistory = [
  {
    role: "system",
    content: "You are a helpful assistant. Do not mention knowledge cutoff."
  }
];

//  Retry function for API calls
async function fetchWithRetry(url, options, retries = 2) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries === 0) throw err;
    console.log("Retrying API call...");
    return fetchWithRetry(url, options, retries - 1);
  }
}

//  Health check route
app.get("/", (req, res) => {
  res.send("Chatbot backend is running 🚀");
});

//  Chat API
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    //  1. Validate input
    if (!userMessage || userMessage.trim() === "") {
      return res.status(400).json({
        reply: "Message cannot be empty ❗"
      });
    }

    //  2. Add user message to history
    chatHistory.push({
      role: "user",
      content: userMessage
    });

    //  3. Call Groq API
    const response = await fetchWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: chatHistory
        })
      }
    );

    //  4. Check response
    if (!response.ok) {
      throw new Error("Groq API request failed");
    }

    const data = await response.json();
    console.log("API RESPONSE:", data);

    //  5. Extract reply safely
    let reply = "No response from AI";

    if (data?.choices?.length > 0) {
      reply = data.choices[0].message.content;
    }

    //  6. Save bot reply in history
    chatHistory.push({
      role: "assistant",
      content: reply
    });

    //  7. Send response to frontend
    res.json({ reply });

  } catch (error) {
    console.error("ERROR:", error);

    res.status(500).json({
      reply: "Server error. Please try again ⚠️"
    });
  }
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});