/**
 * Conversation Momentum Engine
 *
 * Tracks how emotionally engaged the user is and adjusts
 * conversation energy in real time.
 *
 * This is the most advanced layer — it reads engagement signals
 * across the conversation and dynamically shifts the AI's energy
 * level to match or gently guide the user's momentum.
 *
 * Momentum is NOT sentiment. A user can be negatively engaged
 * (frustrated but invested) which is high momentum.
 */

import { ConversationMessage, IntentAnalysis, EmotionalState } from "./types.js";

// ─── Momentum Score ──────────────────────────────────────────

export interface MomentumState {
  /** Current momentum score (0-100). 0 = disengaged, 100 = deeply invested */
  score: number;
  /** Momentum trend over last N messages */
  trend: "rising" | "stable" | "falling";
  /** Recommended energy level for the AI's next response */
  energyRecommendation: "low" | "match" | "slightly_above" | "high";
  /** Specific guidance for the Relationship Brain */
  guidance: string;
  /** Raw engagement signals detected */
  signals: EngagementSignal[];
}

export interface EngagementSignal {
  type: string;
  weight: number;
  description: string;
}

// ─── Signal Detection ────────────────────────────────────────

/**
 * Analyze a message for engagement signals.
 */
function detectEngagementSignals(message: string): EngagementSignal[] {
  const signals: EngagementSignal[] = [];
  const lower = message.toLowerCase();

  // --- Positive engagement signals ---

  // Question marks indicate curiosity / investment
  const questionCount = (message.match(/\?/g) || []).length;
  if (questionCount >= 2) {
    signals.push({
      type: "multiple_questions",
      weight: 15,
      description: "User asked multiple questions — highly engaged",
    });
  } else if (questionCount === 1) {
    signals.push({
      type: "single_question",
      weight: 8,
      description: "User asked a question — engaged",
    });
  }

  // Long messages indicate investment
  const wordCount = message.split(/\s+/).length;
  if (wordCount > 50) {
    signals.push({
      type: "long_message",
      weight: 12,
      description: "Long detailed message — deeply invested",
    });
  } else if (wordCount > 25) {
    signals.push({
      type: "medium_message",
      weight: 6,
      description: "Moderate length message — reasonably engaged",
    });
  }

  // Exclamation marks indicate excitement or emphasis
  const exclamationCount = (message.match(/!/g) || []).length;
  if (exclamationCount >= 2) {
    signals.push({
      type: "excitement",
      weight: 10,
      description: "Multiple exclamation marks — emotionally activated",
    });
  }

  // Personal disclosure signals
  const personalIndicators = [
    "i've been", "i was", "i am", "i feel", "my wife",
    "my husband", "my kids", "my family", "my job",
    "my boss", "personally", "honestly", "to be honest",
    "between you and me", "i'm worried", "i'm excited",
    "i'm thinking", "i've decided",
  ];
  const personalMatches = personalIndicators.filter((p) => lower.includes(p));
  if (personalMatches.length > 0) {
    signals.push({
      type: "personal_disclosure",
      weight: 10 + personalMatches.length * 3,
      description: `Personal disclosure detected (${personalMatches.length} indicators)`,
    });
  }

  // Future-oriented language indicates planning/commitment
  const futureIndicators = [
    "planning to", "going to", "want to", "hoping to",
    "next month", "next year", "this summer", "by the end of",
    "eventually", "someday", "in the future",
  ];
  const futureMatches = futureIndicators.filter((f) => lower.includes(f));
  if (futureMatches.length > 0) {
    signals.push({
      type: "future_planning",
      weight: 8,
      description: "Future-oriented language — invested in outcomes",
    });
  }

  // --- Negative engagement signals ---

  // Very short messages (under 5 words) might indicate disengagement
  if (wordCount <= 3) {
    signals.push({
      type: "very_short",
      weight: -8,
      description: "Very short response — possible disengagement",
    });
  }

  // Generic/dismissive responses
  const dismissive = ["ok", "sure", "fine", "whatever", "idk", "k", "cool", "alright"];
  if (dismissive.includes(lower.trim().replace(/[.!]/g, ""))) {
    signals.push({
      type: "dismissive",
      weight: -15,
      description: "Dismissive/generic response — disengaging",
    });
  }

  // Delay/avoidance language
  const avoidance = [
    "maybe later", "not sure yet", "i'll think about it",
    "let me get back to you", "not right now", "not ready",
  ];
  if (avoidance.some((a) => lower.includes(a))) {
    signals.push({
      type: "avoidance",
      weight: -10,
      description: "Avoidance language detected — pulling back",
    });
  }

  return signals;
}

// ─── Momentum Calculation ────────────────────────────────────

/** History of recent momentum scores for trend detection */
let momentumHistory: number[] = [];
const MAX_HISTORY = 10;

/**
 * Calculate the current conversation momentum.
 */
export function calculateMomentum(
  currentMessage: string,
  conversationHistory: ConversationMessage[],
  intentAnalysis: IntentAnalysis
): MomentumState {
  const signals = detectEngagementSignals(currentMessage);

  // Base score from engagement signals
  let rawScore = 40; // Start at neutral
  for (const signal of signals) {
    rawScore += signal.weight;
  }

  // Factor in emotional state
  const emotionBoosts: Record<string, number> = {
    excited: 15,
    hopeful: 10,
    positive: 8,
    neutral: 0,
    confused: 5,     // confused but engaging is still momentum
    anxious: 3,      // anxious = invested
    frustrated: -5,   // frustrated but might still be engaged
    skeptical: -3,
    stressed: -5,
    sad: -8,
  };
  rawScore += emotionBoosts[intentAnalysis.emotion] || 0;

  // Factor in intent score — higher intent = more momentum
  rawScore += Math.floor(intentAnalysis.intentScore * 0.15);

  // Factor in conversation length (more messages = more invested)
  const msgBonus = Math.min(conversationHistory.length * 2, 15);
  rawScore += msgBonus;

  // Clamp to 0-100
  const score = Math.max(0, Math.min(100, rawScore));

  // Track history for trend detection
  momentumHistory.push(score);
  if (momentumHistory.length > MAX_HISTORY) {
    momentumHistory = momentumHistory.slice(-MAX_HISTORY);
  }

  // Detect trend
  const trend = detectTrend(momentumHistory);

  // Determine energy recommendation
  const energyRecommendation = getEnergyRecommendation(score, trend, intentAnalysis);

  // Generate guidance
  const guidance = generateMomentumGuidance(score, trend, intentAnalysis, signals);

  return {
    score,
    trend,
    energyRecommendation,
    guidance,
    signals,
  };
}

/**
 * Detect the trend direction from momentum history.
 */
function detectTrend(history: number[]): "rising" | "stable" | "falling" {
  if (history.length < 3) return "stable";

  const recent = history.slice(-3);
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;

  const older = history.slice(-6, -3);
  if (older.length === 0) return "stable";

  const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;

  const diff = avgRecent - avgOlder;

  if (diff > 8) return "rising";
  if (diff < -8) return "falling";
  return "stable";
}

/**
 * Recommend how much energy the AI should bring.
 */
function getEnergyRecommendation(
  score: number,
  trend: string,
  intent: IntentAnalysis
): "low" | "match" | "slightly_above" | "high" {
  // If user is upset, stay low
  if (["frustrated", "sad", "stressed"].includes(intent.emotion)) {
    return "low";
  }

  // If momentum is falling, don't overcompensate — go low/match
  if (trend === "falling") {
    return score > 50 ? "match" : "low";
  }

  // If momentum is high and rising, match but don't surpass
  if (score > 70 && trend === "rising") {
    return "match";
  }

  // If momentum is medium, be slightly above to energize
  if (score >= 40 && score <= 70) {
    return "slightly_above";
  }

  // If momentum is low, be warm but don't push
  if (score < 40) {
    return "low";
  }

  return "match";
}

/**
 * Generate human-readable guidance for the Relationship Brain.
 */
function generateMomentumGuidance(
  score: number,
  trend: string,
  intent: IntentAnalysis,
  signals: EngagementSignal[]
): string {
  const parts: string[] = [];

  if (score > 75) {
    parts.push("User is highly engaged. Match their energy. This is a good time for deeper conversation.");
  } else if (score > 50) {
    parts.push("Moderate engagement. Keep things interesting. Ask a thoughtful question.");
  } else if (score > 30) {
    parts.push("Engagement is lukewarm. Keep it light and low-pressure. Don't push.");
  } else {
    parts.push("Low engagement. Be warm but brief. Give them space. Maybe a casual observation.");
  }

  if (trend === "falling") {
    parts.push("Momentum is dropping — simplify, shorten responses, and re-engage with curiosity.");
  } else if (trend === "rising") {
    parts.push("Momentum is building — lean in, but let them drive the conversation.");
  }

  // Specific signal-based guidance
  const hasPersonalDisclosure = signals.some((s) => s.type === "personal_disclosure");
  if (hasPersonalDisclosure) {
    parts.push("They shared something personal — acknowledge it naturally, don't over-react.");
  }

  const hasDismissive = signals.some((s) => s.type === "dismissive");
  if (hasDismissive) {
    parts.push("Response was dismissive. Don't take it personally. Try a different angle or give space.");
  }

  return parts.join(" ");
}

/**
 * Reset momentum state (for testing or new sessions).
 */
export function resetMomentumState(): void {
  momentumHistory = [];
}
