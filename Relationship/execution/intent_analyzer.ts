/**
 * Sales Intelligence Brain — Intent Analyzer
 *
 * Analyzes each inbound message for buying signals, emotional state,
 * intent stage, and decision readiness. Runs through Claude for
 * nuanced interpretation. Never speaks to the client.
 */

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import "dotenv/config";
import {
  IntentAnalysis,
  ClientProfile,
  ConversationMessage,
} from "./types.js";

// ─── Configuration ───────────────────────────────────────────

// ─── Lazy Client Factory ─────────────────────────────────────
// IMPORTANT: Must NOT be top-level — dotenv loads AFTER module imports in ESM.
function getAnthropicClient() {
  const activeKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
  const isOR = activeKey?.startsWith("sk-or-v1");
  
  if (isOR) {
    return {
      client: {
        messages: {
          create: async (params: any) => {
            // OpenRouter uses OpenAI format: system must be first message with role "system"
            const messagesWithSystem = [
              ...(params.system ? [{ role: "system", content: params.system }] : []),
              ...params.messages.map((m: any) => ({
                role: m.role,
                content: m.content
              }))
            ];

            const response = await axios.post(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                model: "anthropic/claude-3-haiku",
                messages: messagesWithSystem,
                max_tokens: params.max_tokens,
              },
              {
                headers: {
                  "Authorization": `Bearer ${activeKey}`,
                  "HTTP-Referer": "https://marketingwithkimani.co.ke",
                  "X-Title": "Marketing with Kimani",
                  "Content-Type": "application/json",
                },
              }
            );
            
            const choice = response.data.choices[0];
            return {
              content: [
                {
                  type: "text",
                  text: choice.message.content
                }
              ]
            };
          }
        }
      } as any,
      model: "anthropic/claude-3-haiku",
    };
  }

  return {
    client: new Anthropic({
      apiKey: activeKey,
    }),
    model: "claude-3-5-sonnet-latest",
  };
}

const INTENT_ANALYSIS_PROMPT = `You are the Sales Intelligence Brain of a Relationship AI system.

Your job is to analyze a client message and conversation history to produce a structured intent analysis. You NEVER speak to the client. You only produce internal analysis for the Relationship Brain to use.

Analyze for:
1. Intent Score (0-100): How close is this person to making a purchase/conversion?
2. Intent Stage: curiosity | exploration | evaluation | consideration | purchase_readiness | conversion | long_term_relationship
3. Emotional State: neutral | positive | excited | anxious | frustrated | confused | sad | stressed | hopeful | skeptical
4. Buying Signals: List any explicit or implicit buying signals detected
5. Suggested Move: What should the Relationship Brain do next?
6. Avoid: What should the Relationship Brain NOT do?
7. Decision Readiness (0-100): How ready are they to make a decision?
8. Knowledge Level: beginner | intermediate | advanced — how much do they know about the product/service?

Consider the full conversation history and client profile for context.

Respond ONLY with valid JSON matching this exact structure.
DO NOT wrap the response in markdown code blocks or triple backticks.
REQUIRED JSON FORMAT:
{
  "intentScore": <number>,
  "stage": "<stage>",
  "emotion": "<emotion>",
  "buyingSignals": ["<signal1>", ...],
  "suggestedMove": "<what to do>",
  "avoid": "<what not to do>",
  "decisionReadiness": <number>,
  "knowledgeLevel": "<level>"
}`;

// ─── Core Function ───────────────────────────────────────────

/**
 * Analyze a client message for intent, emotion, and buying signals.
 */
export async function analyzeIntent(
  message: string,
  conversationHistory: ConversationMessage[],
  clientProfile: ClientProfile | null
): Promise<IntentAnalysis> {
  const contextParts: string[] = [];

  // Add client profile context if available
  if (clientProfile) {
    contextParts.push(`CLIENT PROFILE:
Name: ${clientProfile.name || "Unknown"}
Profession: ${clientProfile.profession || "Unknown"}
Goals: ${clientProfile.goals.join(", ") || "None recorded"}
Challenges: ${clientProfile.challenges.join(", ") || "None recorded"}
Interests: ${clientProfile.interests.join(", ") || "None recorded"}
Conversation Count: ${clientProfile.conversationCount}
Previous Intent History: ${JSON.stringify(clientProfile.intentHistory.slice(-5))}
Notes: ${clientProfile.notes || "None"}`);
  } else {
    contextParts.push("CLIENT PROFILE: New client — no profile exists yet.");
  }

  // Add recent conversation history
  if (conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-10);
    contextParts.push(
      `RECENT CONVERSATION:\n${recentHistory
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")}`
    );
  }

  contextParts.push(`NEW MESSAGE FROM CLIENT:\n${message}`);

  try {
    const { client: anthropic, model } = getAnthropicClient();
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: INTENT_ANALYSIS_PROMPT,
      messages: [
        {
          role: "user",
          content: contextParts.join("\n\n---\n\n"),
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Robust JSON extraction (handles conversational preamble and markdown blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text;
    
    const parsed = JSON.parse(cleanJson);
    return IntentAnalysis.parse(parsed);
  } catch (error) {
    console.error("Intent analysis failed, returning defaults:", error);

    // Safe fallback — never block the response pipeline
    return {
      intentScore: 20,
      stage: "curiosity",
      emotion: "neutral",
      buyingSignals: [],
      suggestedMove: "Build rapport and learn about the client",
      avoid: "Pushing products or making assumptions",
      decisionReadiness: 10,
      knowledgeLevel: "beginner",
    };
  }
}

/**
 * Detect if intent has dropped significantly (user pulling back).
 * Used by the Relationship Brain to back off sales pressure.
 */
export function detectIntentDrop(
  clientProfile: ClientProfile
): boolean {
  const history = clientProfile.intentHistory;
  if (history.length < 2) return false;

  const recent = history[history.length - 1];
  const previous = history[history.length - 2];

  // If score dropped by 15+ points, user is pulling back
  return previous.score - recent.score >= 15;
}

/**
 * Check if the client is in conversion-ready territory.
 */
export function isConversionReady(analysis: IntentAnalysis): boolean {
  return (
    analysis.intentScore >= 70 &&
    analysis.decisionReadiness >= 60 &&
    (analysis.stage === "purchase_readiness" || analysis.stage === "conversion")
  );
}
