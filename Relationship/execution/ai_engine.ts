/**
 * AI Engine - Core Dual-Brain Engine
 */
import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  AIEngineOutput,
  ClientProfile,
  ConversationMessage,
  IntentAnalysis,
  PersonalityConfig,
  VariabilityDirective,
} from "./types.js";
import { MomentumState } from "./momentum_engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAnthropicClient() {
  const activeKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
  const isOR = activeKey?.startsWith("sk-or-v1");
  if (isOR) {
    return {
      client: {
        messages: {
          create: async (params: any) => {
            const messagesWithSystem = [
              ...(params.system ? [{ role: "system", content: params.system }] : []),
              ...params.messages.map((m: any) => ({ role: m.role, content: m.content }))
            ];
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
              model: "openai/gpt-4o-mini",
              messages: messagesWithSystem,
              max_tokens: params.max_tokens || 1000,
            }, {
              headers: {
                "Authorization": "Bearer " + activeKey,
                "HTTP-Referer": "https://marketingwithkimani.co.ke",
                "X-Title": "Marketing with Kimani",
                "Content-Type": "application/json",
              },
            });
            const choice = response.data.choices[0];
            return { content: [{ type: "text", text: choice.message.content }] };
          }
        }
      } as any,
      model: "openai/gpt-4o-mini",
    };
  }
  return { client: new Anthropic({ apiKey: activeKey }), model: "claude-3-5-sonnet-latest" };
}

import * as fs from "fs";
import * as path from "path";

function loadPersonality(): PersonalityConfig {
  const configPath = path.join(process.cwd(), "Relationship", "execution", "personality_config.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return PersonalityConfig.parse(JSON.parse(raw));
}

function buildSystemPrompt(
  personality: PersonalityConfig,
  clientProfile: ClientProfile | null,
  intentAnalysis: IntentAnalysis,
  variability: VariabilityDirective,
  momentum?: MomentumState
): string {
  const countryContext = clientProfile?.country 
    ? `The user is based in ${clientProfile.country}. Adapt language to feel locally relatable.` 
    : "";

  return `You are the Relationship Agent — the voice of the Relationship Engine built by Marketing with Kimani.
Bio: ${personality.bio ?? ""}

═══════════════════════════════════════════
CRITICAL FORMAT RULE — READ THIS FIRST
═══════════════════════════════════════════

You MUST format EVERY response as MULTIPLE SHORT MESSAGE BUBBLES separated by the token [BURST].
This is NON-NEGOTIABLE. Every single response. No exceptions.

RULES:
1. Use [BURST] to split your response into 3 to 5 separate short bubbles.
2. Each bubble = 1 to 2 short sentences max. Like texting.
3. Use these emojis ONLY: 🙂 😅 🤔 👀 👋🏾 — use 1 per response.
4. ZERO bullet points. ZERO numbered lists. ZERO headers.
5. NEVER end mid-thought. If you start an idea, finish it before the next [BURST].
6. ONE question only. Always at the very end. Never in the middle.
7. Complete every insight before asking anything.

═══════════════════════════════════════════
EXAMPLES OF CORRECT OUTPUT FORMAT
═══════════════════════════════════════════

Example 1 (user says "I run a real estate company"):
<correct>
ahh, real estate — interesting space right now 🤔 [BURST] the challenge most firms face is that leads come in curious, then go cold before they're ready to commit [BURST] that gap between "I'm interested" and "I'm ready to sign" is where most deals die, not because the client wasn't interested, but because nobody stayed in the picture [BURST] what does your current follow-up process look like after a first inquiry?
</correct>

Example 2 (user asks "how does this work?"):
<correct>
good question — it's not as complicated as it sounds 😅 [BURST] basically the Relationship Engine stays in contact with your leads in a way that feels human, not automated [BURST] it remembers what they told you, checks in at the right moments, and keeps your name relevant in their lives until they're ready [BURST] think of it as the conversation that never drops off — even when you're busy [BURST] what kind of business are you running?
</correct>

Example 3 (user sends a short reply like "okay"):
<correct>
yeah, I heard you 👀 [BURST] most people don't realise how much business leaves quietly — not because the client said no, but because life got in the way [BURST] where are you based?
</correct>

═══════════════════════════════════════════
BEHAVIORAL RULES
═══════════════════════════════════════════

- African market focus. The 67% who observe slowly and buy through trust, not hype.
- Simple English. No western corporate jargon. No heavy slang.
- Anti-sales. Never push. Never pitch first. Build trust through insight.
- Human first. Sound like a thoughtful person, not a chatbot.
- Drip insights. Don't explain everything at once.
${countryContext}

═══════════════════════════════════════════
STRATEGIC ANALYSIS (HIDDEN FROM USER)
═══════════════════════════════════════════

Start your response with this JSON block (it will be stripped before the user sees it):
<strategist_analysis>
{
  "intentScore": 0-100,
  "stage": "curiosity" | "exploration" | "evaluation" | "consideration" | "purchase_readiness",
  "emotion": "neutral" | "positive" | "excited" | "anxious" | "frustrated" | "confused",
  "buyingSignals": [],
  "decisionReadiness": 0-100,
  "suggestedMove": "one sentence",
  "avoid": "one sentence",
  "discoverySummary": "summary of what you know about this client"
}
</strategist_analysis>

Then write your [BURST]-formatted response AFTER the closing tag.`;
}


// --- Public API ---

/**
 * Generate a response from the Relationship Brain.
 */
export async function generateResponse(
  message: string,
  conversationHistory: ConversationMessage[],
  clientProfile: ClientProfile | null,
  variability: VariabilityDirective,
  momentum?: MomentumState
): Promise<{
  response: string;
  intent: IntentAnalysis;
  memoryUpdates: Record<string, unknown>;
  discoverySummary: string;
  suggestedNextAction: string;
  scheduledFollowUps: AIEngineOutput["scheduledFollowUps"];
}> {
  // HARD-PINNED GREETING: Ensure the first impression is flawless
  if (message === "[CLIENT_LANDED_ON_PAGE]") {
    return {
      response: "hey, welcome 👋🏾 [BURST] glad you found the middle space [BURST] it's where most of the real thinking happens, right? [BURST] quick one — what are you trying to improve in your business right now? [BURST] and where are you based?",
      intent: {
        intentScore: 30,
        stage: "curiosity",
        emotion: "neutral",
        buyingSignals: [],
        decisionReadiness: 10,
        knowledgeLevel: "beginner",
        suggestedMove: "Establish rapport",
        avoid: "Don't push"
      } as IntentAnalysis,
      discoverySummary: "Establishing rapport...",
      suggestedNextAction: "Continue discovery.",
      memoryUpdates: {},
      scheduledFollowUps: [],
    };
  }

  const personality = loadPersonality();
  const { client: anthropic, model } = getAnthropicClient();

  // Create a default intent object in case the AI fails to output one
  const defaultIntent: IntentAnalysis = {
    intentScore: 40,
    stage: "exploration",
    emotion: "curious",
    buyingSignals: [],
    decisionReadiness: 20,
    knowledgeLevel: "intermediate",
    suggestedMove: "Keep conversation flowing",
    avoid: "Sales pressure"
  } as IntentAnalysis;

  const systemPrompt = buildSystemPrompt(
    personality,
    clientProfile,
    defaultIntent, // Passing default to prompt builder for structure
    variability,
    momentum
  );

  // Build Claude message history
  const messages: Anthropic.MessageParam[] = [];

  // Add conversation history
  for (const msg of conversationHistory.slice(-15)) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current message
  messages.push({
    role: "user",
    content: message + "\n\n(REMINDER: Start with <strategist_analysis> JSON block, then your human message)",
  });

  try {
    const response = await anthropic.messages.create({
      model,
    max_tokens: 1500,
      system: systemPrompt,
      messages,
    });

    const fullText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // 1. Extract Strategist Analysis
    const analysisMatch = fullText.match(/<strategist_analysis>([\s\S]*?)<\/strategist_analysis>/);
    let intent: IntentAnalysis = defaultIntent;
    
    if (analysisMatch) {
      try {
        const parsed = JSON.parse(analysisMatch[1].trim());
        intent = { ...defaultIntent, ...parsed };
      } catch (e) {
        console.warn("Strategist analysis parse failed, using defaults.");
      }
    }

    // 2. Parse out optional memory updates
    const memoryMatch = fullText.match(/<memory_update>([\s\S]*?)<\/memory_update>/);
    let memoryUpdates: Record<string, unknown> = {};
    if (memoryMatch) {
      try { memoryUpdates = JSON.parse(memoryMatch[1].trim()); } catch {}
    }

    // 3. Extract the actual response (everything after the analysis tag)
    let responseText = fullText
      .replace(/<strategist_analysis>[\s\S]*?<\/strategist_analysis>/, "")
      .replace(/<memory_update>[\s\S]*?<\/memory_update>/, "")
      .trim();

    // 4. Server-side cleanup + HARD-ENFORCEMENT BURST SPLITTER
    let bursts = responseText.split("[BURST]").map(b => b.trim()).filter(b => b.length > 0);
    
    // ENFORCEMENT: If GPT-mini ignored [BURST] and returned 1 block, force-split at sentences
    if (bursts.length < 2 && responseText.length > 80) {
      const sentences = responseText.match(/[^.!?]+[.!?]+/g) || [responseText];
      if (sentences.length >= 4) {
        // Split into 3 meaningful groups
        const third = Math.ceil(sentences.length / 3);
        bursts = [
          sentences.slice(0, third).join(' ').trim(),
          sentences.slice(third, third * 2).join(' ').trim(),
          sentences.slice(third * 2).join(' ').trim(),
        ].filter(b => b.length > 0);
      } else if (sentences.length >= 2) {
        bursts = sentences.map(s => s.trim()).filter(s => s.length > 0);
      }
    }
    
    // Safety clamp
    if (bursts.length > 6) bursts = bursts.slice(0, 6);
    
    // Length limit to ensure thought completion (raised to 600)
    bursts = bursts.map(b => (b.length > 600 ? b.substring(0, 597) + "..." : b));
    responseText = bursts.join(" [BURST] ").trim();

    // 5. Build output
    return {
      response: responseText,
      intent,
      memoryUpdates,
      discoverySummary: intent.discoverySummary || "Establishing rapport...",
      suggestedNextAction: intent.suggestedMove || "Continue discovery.",
      scheduledFollowUps: [], // Logic handled in server.ts
    };
  } catch (error) {
    console.error("AI Engine response generation failed:", error);
    throw error;
  }
}

/**
 * Estimate how many days until a follow-up should fire.
 */
function estimateDelayDays(approximateDate: string): number {
  try {
    const target = new Date(approximateDate);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Follow up a few days before the event
    return Math.max(1, diffDays - 3);
  } catch {
    // Default to 7 days if we can't parse the date
    return 7;
  }
}
