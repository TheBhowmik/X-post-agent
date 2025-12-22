import { config } from "dotenv";
import readline from "readline/promises";
import { GoogleGenAI } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

config();

/* -------------------- SETUP -------------------- */

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const mcpClient = new Client({
  name: "example-client",
  version: "1.0.0",
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const chatHistory = [];
let tools = [];

/* -------------------- CONNECT MCP -------------------- */

await mcpClient.connect(
  new SSEClientTransport(new URL("http://localhost:3001/sse"))
);

console.log("Connected to MCP server");

/* -------------------- LOAD TOOLS -------------------- */

const mcpTools = await mcpClient.listTools();

tools = mcpTools.tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: {
    type: tool.inputSchema.type,
    properties: tool.inputSchema.properties,
    required: tool.inputSchema.required,
  },
}));

/* -------------------- CHAT LOOP -------------------- */

async function chatLoop() {
  let awaitingUserInput = true;

  while (true) {
    /* ---------- USER INPUT PHASE ---------- */
    if (awaitingUserInput) {
      const question = await rl.question("You: ");

      chatHistory.push({
        role: "user",
        parts: [{ text: question, type: "text" }],
      });
    }

    awaitingUserInput = false;
    console.log("Sending request to Gemini...");

    let response;
    try {
      response = await ai.models.generateContent({
        model: "models/gemini-2.5-flash", // ✅ REQUIRED PREFIX
        contents: chatHistory,
        config: {
          tools: [{ functionDeclarations: tools }],
        },
      });
    } catch (err) {
      console.error("AI error:", err.message);
      awaitingUserInput = true;
      continue;
    }

    const candidate = response.candidates[0];
    const part = candidate.content.parts[0];

    /* ---------- TOOL CALL PHASE ---------- */
    if (part.functionCall) {
      const fn = part.functionCall;
      console.log("Calling tool:", fn.name);

      // 1️⃣ Save MODEL INTENT
      chatHistory.push(candidate.content);

      // 2️⃣ Execute tool
      const toolResult = await mcpClient.callTool({
        name: fn.name,
        arguments: fn.args,
      });

      // 3️⃣ Normalize tool output → valid JSON
      const rawText = toolResult?.content?.[0]?.text ?? "";
      let parsedResult;

      try {
        parsedResult = JSON.parse(rawText);
      } catch {
        parsedResult = { result: rawText };
      }

      // 4️⃣ Send FUNCTION RESPONSE (STRICT Gemini schema)
      chatHistory.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: fn.name,
              response: parsedResult,
            },
          },
        ],
      });

      // 🔁 Let Gemini respond — DO NOT ask user yet
      continue;
    }

    /* ---------- FINAL MODEL RESPONSE ---------- */
    if (part.text) {
      console.log("AI:", part.text);
      chatHistory.push(candidate.content);
    }

    awaitingUserInput = true;
  }
}

/* -------------------- START -------------------- */

chatLoop();
