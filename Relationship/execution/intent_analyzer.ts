/**
 * Sales Intelligence Brain — Intent Analyzer
 *
 * Analyzes each inbound message for buying signals, emotional state,
 * intent stage, and decision readiness. Runs through Claude for
 * nuanced interpretation. Never speaks to the client.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  IntentAnalysis,
  ClientProfile,
  ConversationMessage,
} from "./types.js";

// ─── Configuration ───────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_API_KEY?.startsWith("sk-or-v1") 
    ? "https://openrouter.ai/api/v1" 
    : undefined,
});

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

Respond ONLY with valid JSON matching this exact structure:
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
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_API_KEY?.startsWith("sk-or-v1")
        ? "anthropic/claude-3.5-sonnet"
        : "claude-3-5-sonnet-latest",
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

    // Parse JSON response
    const parsed = JSON.parse(text);
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
