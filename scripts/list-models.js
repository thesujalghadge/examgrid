const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy");
  try {
     const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + process.env.GEMINI_API_KEY);
     const data = await response.json();
     data.models.forEach(m => console.log(m.name));
  } catch (e) {
     console.error(e);
  }
}
listModels();
