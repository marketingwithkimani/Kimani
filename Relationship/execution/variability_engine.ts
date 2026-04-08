/**
 * Conversation Variability Engine
 *
 * Prevents AI-sounding response patterns by selecting response modes,
 * injecting pattern breakers, and varying response length/tone.
 *
 * This is what makes the AI feel human.
 */

import {
  ResponseMode,
  VariabilityDirective,
  IntentAnalysis,
  ConversationMessage,
} from "./types.js";

// ─── Mode Weights ────────────────────────────────────────────
// Higher weight = more likely to be selected
// Analytical and Story modes are intentionally rare

const MODE_WEIGHTS: Record<string, number> = {
  curious: 25,
  reflective: 20,
  observational: 15,
  casual_commentary: 15,
  personal_advisor: 10,
  minimal: 8,
  story: 4,
  analytical: 3,
};

// ─── Pattern Breakers ────────────────────────────────────────

const COGNITIVE_DELAYS = [
  "Hmm.",
  "Let me think about that.",
  "Actually wait.",
  "Hold on —",
  "Interesting.",
  "Hmm, good question.",
  "Let me think for a sec.",
];

const IMPERFECT_KNOWLEDGE = [
  "I might be wrong, but…",
  "There are a few ways to look at this.",
  "Not 100% sure on this, but…",
  "From what I've seen…",
  "This might not apply to your case, but…",
];

const CONVERSATIONAL_INTERRUPTIONS = [
  "Actually hold on —",
  "Wait, quick question first —",
  "Oh actually —",
  "Before I answer that —",
  "Side note real quick —",
];

const EMOTIONAL_ECHOES: Record<string, string[]> = {
  stressed: [
    "Yeah… that's a tough place to be.",
    "That sounds rough.",
    "I get that.",
  ],
  frustrated: [
    "That's frustrating.",
    "Yeah, I can see why that would be annoying.",
    "Fair enough.",
  ],
  anxious: [
    "That kind of uncertainty is hard.",
    "Makes sense to feel that way.",
    "Yeah, that's a lot to sit with.",
  ],
  sad: [
    "That's tough.",
    "Sorry to hear that.",
    "Yeah… that's hard.",
  ],
  excited: [
    "That's awesome.",
    "Nice.",
    "Love that.",
  ],
  hopeful: [
    "Sounds like things are heading in a good direction.",
    "That's promising.",
    "Good sign.",
  ],
  confused: [
    "Yeah, this part gets confusing.",
    "Honestly this confuses a lot of people.",
    "Totally fair — it's not straightforward.",
  ],
};

// ─── Length Guidance ──────────────────────────────────────────

const LENGTH_PATTERNS = ["minimal", "short", "medium", "short", "long", "short", "minimal", "medium"] as const;

// ─── Internal State ──────────────────────────────────────────

let messageCounter = 0;
let lastMode: string = "";
let consecutiveSameModeCount = 0;

// ─── Core Functions ──────────────────────────────────────────

/**
 * Select a weighted random response mode, avoiding repetition.
 */
function selectMode(intent: IntentAnalysis): ResponseMode {
  // Override: if user is upset, always use reflective or minimal
  if (["frustrated", "sad", "stressed", "anxious"].includes(intent.emotion)) {
    const emotionalModes: ResponseMode[] = ["reflective", "minimal", "casual_commentary"];
    return emotionalModes[Math.floor(Math.random() * emotionalModes.length)];
  }

  // Override: if conversion-ready, lean toward personal_advisor or analytical
  if (intent.intentScore >= 70 && intent.stage === "purchase_readiness") {
    const conversionModes: ResponseMode[] = ["personal_advisor", "analytical", "reflective"];
    return conversionModes[Math.floor(Math.random() * conversionModes.length)];
  }

  // Weighted random selection
  const entries = Object.entries(MODE_WEIGHTS);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let random = Math.random() * totalWeight;

  let selected: ResponseMode = "curious";
  for (const [mode, weight] of entries) {
    random -= weight;
    if (random <= 0) {
      selected = mode as ResponseMode;
      break;
    }
  }

  // Avoid using the same mode 3+ times in a row
  if (selected === lastMode) {
    consecutiveSameModeCount++;
    if (consecutiveSameModeCount >= 2) {
      // Force a different mode
      const others = entries.filter(([m]) => m !== lastMode);
      const otherTotal = others.reduce((sum, [, w]) => sum + w, 0);
      let r = Math.random() * otherTotal;
      for (const [mode, weight] of others) {
        r -= weight;
        if (r <= 0) {
          selected = mode as ResponseMode;
          break;
        }
      }
      consecutiveSameModeCount = 0;
    }
  } else {
    consecutiveSameModeCount = 0;
  }

  lastMode = selected;
  return selected;
}

/**
 * Pick a random item from an array.
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Determine which pattern breakers to apply for this message.
 */
function selectPatternBreakers(
  intent: IntentAnalysis,
  conversationHistory: ConversationMessage[]
): string[] {
  const breakers: string[] = [];
  const msgCount = conversationHistory.length;

  // Cognitive delay — ~30% of messages, never on first message
  if (msgCount > 0 && Math.random() < 0.3) {
    breakers.push(`cognitive_delay: "${pick(COGNITIVE_DELAYS)}"`);
  }

  // Imperfect knowledge — ~15% of messages, only in analytical or advisor mode
  if (Math.random() < 0.15) {
    breakers.push(`imperfect_knowledge: "${pick(IMPERFECT_KNOWLEDGE)}"`);
  }

  // Conversational interruption — ~10% of messages
  if (msgCount > 2 && Math.random() < 0.1) {
    breakers.push(`interruption: "${pick(CONVERSATIONAL_INTERRUPTIONS)}"`);
  }

  // Emotional echo — when emotion is strongly non-neutral
  const emotionEchoes = EMOTIONAL_ECHOES[intent.emotion];
  if (emotionEchoes && Math.random() < 0.6) {
    breakers.push(`emotional_echo: "${pick(emotionEchoes)}"`);
  }

  return breakers;
}

/**
 * Get a tone shift description based on emotional context.
 */
function selectToneShift(intent: IntentAnalysis): string {
  if (intent.emotion === "frustrated" || intent.emotion === "stressed") {
    return "Softer, slower. Give space. Don't fix — just acknowledge.";
  }
  if (intent.emotion === "excited" || intent.emotion === "positive") {
    return "Match their energy subtly. Be warm but don't over-validate.";
  }
  if (intent.emotion === "confused") {
    return "Clear and grounded. Break things into simpler pieces.";
  }
  if (intent.emotion === "skeptical") {
    return "Honest and direct. Don't over-sell. Acknowledge their hesitation.";
  }
  if (intent.intentScore >= 60) {
    return "Slightly more decisive and advisory. Still natural.";
  }
  return "Natural, conversational. No particular shift needed.";
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Generate a variability directive for the current message.
 * This tells the Relationship Brain HOW to respond.
 */
export function generateVariabilityDirective(
  intent: IntentAnalysis,
  conversationHistory: ConversationMessage[]
): VariabilityDirective {
  messageCounter++;

  const mode = selectMode(intent);
  const lengthIndex = messageCounter % LENGTH_PATTERNS.length;
  const lengthGuidance = LENGTH_PATTERNS[lengthIndex];
  const toneShift = selectToneShift(intent);
  const patternBreakers = selectPatternBreakers(intent, conversationHistory);

  return {
    mode,
    lengthGuidance,
    toneShift,
    patternBreakers,
  };
}

/**
 * Reset internal counters (useful for testing or new sessions).
 */
export function resetVariabilityState(): void {
  messageCounter = 0;
  lastMode = "";
  consecutiveSameModeCount = 0;
}
