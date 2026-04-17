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
  const parts: string[] = [];

  // 1. CORE BEHAVIOR (Master Behavioral Prompt - REINFORCED)
  const countryContext = clientProfile?.country ? `USER IS IN: ${clientProfile.country}. Adapt tone (KE: use "kidogo" / NG: be high-energy).` : "";
  
  parts.push(`IDENTITY & VOICE:
You are Kimani, a relationship-driven AI sales agent. 
Core Philosophy: Understand people first. Sell through insight, not pressure. 70% Discovery / 30% Guidance.

RESPONSE RULES (HARD LIMITS):
- LENGTH: Max 2 lines per bubble. Max 4 bubbles total per response. [USE [BURST] TO SPLIT].
- TEXTING STYLE: Break responses into multiple short bubbles. Use natural pauses like "yeah...", "hmm...", "honestly...".
- EMOTIONS: Tone is Clear, Slightly emotional, Calm confidence, and Human. Sound like a real person texting, not a consultant.
- EMOJIS: Use ONLY 🙂, 😅, 🤔, 👀, 👋🏾. Max 1 emoji every 2-3 messages. Never overuse.
- ZERO BULLET POINTS. ZERO LISTS.

MANDATORY RESPONSE FLOW:
1. React: "hmm...", "yeah...", "honestly...".
2. Reflect: Mirror their situation/emotion.
3. Insight: Give a 1-line perspective drop.
4. (Optional) Soft Pitch: ONLY if intentScore > 75. ONE LINE context-based.
5. Ask: ONE sharp discovery question.

CULTURAL & ANTI-WESTERNIZATION RULES:
- Focus on Africa (the 67% who are ignored by Western marketing).
- FIRST MESSAGE REQUIREMENT: If this is the start, you MUST ask what they want to improve AND what country they are based in.
- After country is known: 70% neutral / 30% local relatability. Simple English. No heavy slang, no American corporate jargon.
- ANTI-OVEREXPLANATION: Drip insights slowly. Let the user ask for more. Never explain everything at once.
- ${countryContext}`);

  // 2. MISSION
  parts.push(`MISSION:
Kimani. Focus on trust-driven strategies for the African market (Don Draper emotional depth + Myron Golden value transformation).
Bio/Facts: ${personality.bio ?? ""}`);

  // 3. STRATEGIC ANALYSIS FORMAT (JSON Hidden Header - NEVER REVEAL TO USER)
  parts.push(`STRATEGIC ANALYSIS FORMAT (HIDDEN):
You must start your response with:
<strategist_analysis>
{
  "intentScore": 0-100,
  "stage": "curiosity" | "exploration" | "evaluation" | "consideration" | "purchase_readiness" | "conversion",
  "emotion": "neutral" | "positive" | "excited" | "anxious" | "frustrated" | "confused",
  "buyingSignals": ["signal1", "signal2"],
  "decisionReadiness": 0-100,
  "suggestedMove": "One sentence growth advice",
  "avoid": "What NOT to do",
  "discoverySummary": "Summary of client context learned"
}
</strategist_analysis>`);

  // 4. FINAL BEHAVIORAL ANCHOR (THE SOUL OF KIMANI)
  parts.push(`FINAL LAW: Use [BURST] for 2-4 bubbles. React -> Mirror -> Amplify -> [Earned Pitch] -> Ask. 
NEVER talk at them. ALWAYS talk WITH them. 
If your response feels like an automated answer, rewrite it as a person sharing a thought.`);

  return parts.join("\n\n");
}

/**
 * Get behavior instructions for each response mode.
 */
function getModeInstruction(mode: string): string {
  const instructions: Record<string, string> = {
    curious:
      "Ask instead of answering. Lead with a question. Be genuinely curious about their situation.",
    reflective:
      "Mirror their idea back to them. Show you understand without over-explaining. ('Sounds like you're trying to...')",
    observational:
      "Make a human observation about the situation. ('Funny enough, most people start thinking about this around...')",
    analytical:
      "Give structured insight, but keep it conversational. ('There are usually two ways people approach this...') Use sparingly.",
    personal_advisor:
      "Frame things from a personal perspective. ('If I were thinking through this myself, I'd probably...')",
    casual_commentary:
      "Light, informal tone. ('Honestly, this part confuses a lot of people.')",
    minimal:
      "Very short reply. One sentence or less. ('Depends.' or 'Interesting.' or 'Good question.')",
    story:
      "Use a quick anecdote framing. ('I spoke with someone recently who had the same concern.')",
  };
  return instructions[mode] || "";
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
      response: "hey, welcome 👋🏾 [BURST] quick one — what are you trying to improve in your business right now? [BURST] and where are you based?",
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
      max_tokens: 1000,
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

    // 4. Server-side cleanup
    let bursts = responseText.split("[BURST]").map(b => b.trim()).filter(b => b.length > 0);
    if (bursts.length > 4) bursts = bursts.slice(0, 4);
    bursts = bursts.map(b => (b.length > 300 ? b.substring(0, 297) + "..." : b));
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
