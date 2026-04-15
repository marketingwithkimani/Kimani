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
              model: "anthropic/claude-3.5-haiku",
              messages: messagesWithSystem,
              max_tokens: params.max_tokens,
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
      model: "anthropic/claude-3.5-haiku",
    };
  }
  return { client: new Anthropic({ apiKey: activeKey }), model: "claude-3-5-sonnet-latest" };
}

function loadPersonality(): PersonalityConfig {
  const configPath = path.join(__dirname, "personality_config.json");
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

  // 1. THE SYSTEM OVERRIDE - BREVITY & RHYTHM
  const countryContext = clientProfile?.country ? `USER IS IN: ${clientProfile.country}. Adapt tone (KE: use "kidogo" / NG: be high-energy).` : "";
  
  parts.push(`NON-NEGOTIABLE OVERRIDE:
- MAX 2 LINES PER BUBBLE. MAX 4 BUBBLES.
- USE [BURST] TO SPLIT.
- 70% Discovery / 30% Soft Pitch.
- ZERO BULLET POINTS. ZERO LISTS.

MANDATORY FLOW:
1. React: "hmm...", "yeah...", "honestly...".
2. Reflect: Mirror their situation.
3. Insight: Give a 1-line perspective drop.
4. (Optional) Pitch: ONE LINE: "That's something I help with."
5. Ask: ONE sharp discovery question.

STYLE:
- Simple English. Sound like a person texting, not a consultant.
- Use ONLY: 🙂, 😅, 👀, 🤔, 👋🏾. Max 1 per response.
- ${countryContext}`);

  // 2. MISSION
  parts.push(`MISSION:
Kimani. Focus on trust-driven strategies for the 67% (African market).
Bio/Facts: ${personality.bio ?? ""}`);

  // 4. STRATEGIST SCRATCHPAD (Hidden metadata)
  parts.push(`SCRATCHPAD DIRECTIVE:
At the end of your response, you MUST include a hidden update block for the dashboard.
Format:
<discovery_update>
[1-sentence summary of what you discovered about their business/needs so far]
</discovery_update>
<suggested_action>
[1-sentence strategic advice for Kimani on how to handle this lead manually]
</suggested_action>`);

  // 5. FINAL BEHAVIORAL ANCHOR
  parts.push(`FINAL LAW: Use [BURST] for 2-5 bubbles. React -> Mirror -> Amplify -> [Earned Pitch] -> Ask. 
NEVER talk at them. ALWAYS talk WITH them. 
If it feels like an answer -> REWRITE as a strategist's insight.`);

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
  intentAnalysis: IntentAnalysis,
  variability: VariabilityDirective,
  momentum?: MomentumState
): Promise<{
  response: string;
  memoryUpdates: Record<string, unknown>;
  scheduledFollowUps: AIEngineOutput["scheduledFollowUps"];
}> {
  // HARD-PINNED GREETING: Ensure the first impression is flawless
  if (message === "[CLIENT_LANDED_ON_PAGE]") {
    return {
      response: "hey, welcome 👋🏾 [BURST] quick one — what are you trying to improve in your business right now? [BURST] and where are you based?",
      intentAnalysis,
      variabilityDirective: variability,
      memoryUpdates: {},
      scheduledFollowUps: [],
    };
  }

  const personality = loadPersonality();
  const { client: anthropic, model } = getAnthropicClient();

  const systemPrompt = buildSystemPrompt(
    personality,
    clientProfile,
    intentAnalysis,
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
    content: message,
  });

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 280,
      system: systemPrompt,
      messages,
    });

    const fullText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse out memory updates
    const memoryMatch = fullText.match(
      /<memory_update>([\s\S]*?)<\/memory_update>/
    );
    let memoryUpdates: Record<string, unknown> = {};
    if (memoryMatch) {
      try {
        memoryUpdates = JSON.parse(memoryMatch[1].trim());
      } catch {
        // Ignore parse errors - memory extraction is best-effort
      }
    }

    // Extract Hidden Metadata
    const discoveryMatch = fullText.match(/<discovery_update>([\s\S]*?)<\/discovery_update>/);
    const discoverySummary = discoveryMatch ? discoveryMatch[1].trim() : "";

    const actionMatch = fullText.match(/<suggested_action>([\s\S]*?)<\/suggested_action>/);
    const suggestedNextAction = actionMatch ? actionMatch[1].trim() : "";

    // Extract the actual response (everything before metadata tags)
    let responseText = fullText
      .replace(/<memory_update>[\s\S]*?<\/memory_update>/, "")
      .replace(/<discovery_update>[\s\S]*?<\/discovery_update>/, "")
      .replace(/<suggested_action>[\s\S]*?<\/suggested_action>/, "")
      .trim();

    // SERVER-SIDE SAFETY NET: Limit to 5 bursts
    const bursts = responseText.split("[BURST]").map(b => b.trim()).filter(b => b.length > 0);
    if (bursts.length > 5) {
      responseText = bursts.slice(0, 5).join(" [BURST] ").trim();
    }

    // Detect scheduled follow-ups from timeline events in memory
    const scheduledFollowUps: AIEngineOutput["scheduledFollowUps"] = [];
    if (memoryUpdates.timelineEvents && Array.isArray(memoryUpdates.timelineEvents)) {
      for (const event of memoryUpdates.timelineEvents) {
        if (event.approximateDate && !event.followedUp) {
          scheduledFollowUps.push({
            message: `Follow up about: ${event.event}`,
            delayDays: estimateDelayDays(event.approximateDate),
            reason: `Client mentioned ${event.event} around ${event.approximateDate}`,
          });
        }
      }
    }

    return {
      response: responseText,
      discoverySummary,
      suggestedNextAction,
      memoryUpdates,
      scheduledFollowUps,
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
