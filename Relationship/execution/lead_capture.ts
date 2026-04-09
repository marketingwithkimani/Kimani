/**
 * Lead Capture Psychology Engine
 *
 * Generates the 3-layer psychological lead capture system:
 *   Layer 1: Psychological Hook (stops scrolling)
 *   Layer 2: Curiosity Expansion (deepens interest)
 *   Layer 3: Lead Capture Moment (positioned as continuation)
 *
 * This system sits BEFORE the email pipeline:
 *   Traffic → Hook → Curiosity → Capture → Email Intelligence
 */

import Anthropic from "@anthropic-ai/sdk";
import { LeadCaptureHook, LeadCapturePage } from "./email_types.js";

// ─── Configuration ───────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_API_KEY?.startsWith("sk-or-v1") 
    ? "https://openrouter.ai/api/v1" 
    : undefined,
});

// ─── Hook Templates (fallbacks) ──────────────────────────────

const HOOK_TEMPLATES = {
  assumption_challenge: [
    "Why most {industry} companies lose leads after the first message.",
    "The mistake most {industry} businesses make when replying to customers.",
    "What {industry} teams get wrong about customer follow-up.",
  ],
  hidden_problem: [
    "The hidden reason customers stop replying after the first conversation.",
    "Why your best leads might be slipping through the cracks.",
    "The follow-up problem nobody talks about in {industry}.",
  ],
  counterintuitive: [
    "Why more leads might actually be making your conversion rate worse.",
    "The counterintuitive reason automation sometimes kills sales.",
    "Why responding faster doesn't always mean converting more.",
  ],
  curiosity_gap: [
    "The one thing we noticed about companies growing faster than their competitors.",
    "What the top 10% of {industry} companies do differently after the first contact.",
    "A pattern we keep seeing in high-converting {industry} teams.",
  ],
};

// ─── Curiosity Expansion Templates ───────────────────────────

const EXPANSION_PATTERNS = [
  {
    setup: "It's rarely because of the product.",
    deepener: "It's usually because the conversation that follows feels… mechanical.",
    tension: "Most companies try to solve this with automation. Ironically, that often makes the problem worse.",
  },
  {
    setup: "The issue isn't lead volume.",
    deepener: "It's what happens in the first 5 minutes after someone reaches out.",
    tension: "Most teams either respond too slowly or respond with something that sounds… robotic.",
  },
  {
    setup: "It's not a marketing problem.",
    deepener: "It's a response quality problem.",
    tension: "The companies growing fastest figured this out. They didn't add more leads — they got better at the conversations they already had.",
  },
];

// ─── Core Generation ─────────────────────────────────────────

const CAPTURE_GENERATION_PROMPT = `You are a conversion psychology expert designing lead capture content.

Your job: create psychologically effective lead capture copy that follows a 3-layer architecture.

Layer 1 — Psychological Hook:
- Must challenge an assumption or reveal a hidden problem
- Must NOT feel like marketing
- Must trigger "Wait… am I doing that?" reaction
- Use the format of a statement, not a question with exclamation marks

Layer 2 — Curiosity Expansion:
- Provide a PARTIAL explanation (never the full answer)
- Create mental agreement ("That's actually true")
- Deepen curiosity so the brain wants the full answer
- 2-4 short paragraphs, conversational tone

Layer 3 — Lead Capture Moment:
- Position as CONTINUATION, not TRANSACTION
- Not "Give us your email" but "Continue learning"
- The capture prompt should feel informational, not promotional
- Button text should be specific and value-oriented

CRITICAL RULES:
- Never use "Download our free guide"
- Never use "limited time" or "exclusive"
- Never sound like a landing page template
- The brain should register: "These people understand something"
- Signal thinking depth through insightful observations

Output JSON:
{
  "hookType": "<assumption_challenge|hidden_problem|counterintuitive|curiosity_gap>",
  "headline": "<the hook headline>",
  "curiosityExpansion": "<2-4 paragraph expansion text>",
  "capturePrompt": "<the text right before the email field>",
  "captureButtonText": "<button text>",
  "psychologyNotes": "<why this works psychologically>",
  "credibilityStatement": "<authority-building statement>",
  "trustTransferLine": "<trust-building line right before capture>"
}`;

/**
 * Generate a complete lead capture page content set.
 */
export async function generateLeadCapture(
  industry: string,
  productOrService: string,
  targetAudience: string,
  valueProposition: string
): Promise<LeadCapturePage> {
  const contextPrompt = `Generate lead capture content for:
Industry: ${industry}
Product/Service: ${productOrService}
Target Audience: ${targetAudience}
Value Proposition: ${valueProposition}

Create content that would make a ${targetAudience} professional think:
1. "This was written specifically for me"
2. "These people seem knowledgeable"
3. "This might actually be useful"`;

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_API_KEY?.startsWith("sk-or-v1")
        ? "anthropic/claude-3.5-sonnet"
        : "claude-3-5-sonnet-latest",
      max_tokens: 2048,
      system: CAPTURE_GENERATION_PROMPT,
      messages: [{ role: "user", content: contextPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);

    const hook: LeadCaptureHook = {
      hookType: parsed.hookType || "assumption_challenge",
      headline: parsed.headline,
      curiosityExpansion: parsed.curiosityExpansion,
      capturePrompt: parsed.capturePrompt,
      captureButtonText: parsed.captureButtonText || "Show me the breakdown",
      psychologyNotes: parsed.psychologyNotes || "",
    };

    return {
      hook,
      credibilityStatement: parsed.credibilityStatement || "",
      trustTransferLine: parsed.trustTransferLine || "",
      formFields: ["email"],  // Only email by default — lowest friction
      targetEmotion: "curious_and_understood",
    };
  } catch (error) {
    console.error("Lead capture generation failed, using template:", error);
    return generateTemplateFallback(industry, productOrService);
  }
}

/**
 * Generate multiple hook variants for A/B testing.
 */
export async function generateHookVariants(
  industry: string,
  productOrService: string,
  count: number = 3
): Promise<LeadCaptureHook[]> {
  const hookTypes = ["assumption_challenge", "hidden_problem", "counterintuitive", "curiosity_gap"] as const;
  const variants: LeadCaptureHook[] = [];

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_API_KEY?.startsWith("sk-or-v1")
      ? "anthropic/claude-3.5-sonnet"
      : "claude-3-5-sonnet-latest",
    max_tokens: 3000,
    system: `You are a conversion psychology expert. Generate ${count} different lead capture hook variants for the ${industry} industry, selling ${productOrService}.

Each variant should use a different psychological approach. Return a JSON array of hooks:
[
  {
    "hookType": "<type>",
    "headline": "<headline>",
    "curiosityExpansion": "<2-3 paragraph expansion>",
    "capturePrompt": "<text before email field>",
    "captureButtonText": "<button text>",
    "psychologyNotes": "<why this works>"
  }
]

RULES:
- Each hook must challenge a different assumption
- No marketing speak
- Each must trigger "Wait… am I doing that?"
- Vary the psychological angle significantly between variants`,
    messages: [
      { role: "user", content: `Generate ${count} hook variants now.` },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      for (const h of parsed) {
        variants.push(LeadCaptureHook.parse(h));
      }
    }
  } catch {
    // Fallback to template-based hooks
    for (let i = 0; i < count && i < hookTypes.length; i++) {
      const type = hookTypes[i];
      const templates = HOOK_TEMPLATES[type];
      variants.push({
        hookType: type,
        headline: templates[0].replace("{industry}", industry),
        curiosityExpansion: EXPANSION_PATTERNS[i % EXPANSION_PATTERNS.length].setup + "\n\n" +
          EXPANSION_PATTERNS[i % EXPANSION_PATTERNS.length].deepener + "\n\n" +
          EXPANSION_PATTERNS[i % EXPANSION_PATTERNS.length].tension,
        capturePrompt: "If you're curious how this works in practice, we put together a short breakdown.",
        captureButtonText: "Send me the breakdown",
        psychologyNotes: `Uses ${type.replace(/_/g, " ")} approach`,
      });
    }
  }

  return variants;
}

// ─── Template Fallback ───────────────────────────────────────

function generateTemplateFallback(
  industry: string,
  productOrService: string
): LeadCapturePage {
  const template = HOOK_TEMPLATES.assumption_challenge[0].replace("{industry}", industry);
  const expansion = EXPANSION_PATTERNS[0];

  return {
    hook: {
      hookType: "assumption_challenge",
      headline: template,
      curiosityExpansion: `${expansion.setup}\n\n${expansion.deepener}\n\n${expansion.tension}`,
      capturePrompt: "If you're curious how the system works in practice, we put together a short breakdown explaining it.",
      captureButtonText: "Send me the breakdown",
      psychologyNotes: "Assumption challenge triggers self-reflection, creating immediate engagement.",
    },
    credibilityStatement: `We recently analyzed thousands of customer conversations in ${industry} and found a pattern most teams completely miss.`,
    trustTransferLine: "If you'd like to see the full breakdown, you can access it below.",
    formFields: ["email"],
    targetEmotion: "curious_and_understood",
  };
}

/**
 * Evaluate a lead capture hook's likely effectiveness.
 */
export function scoreHook(hook: LeadCaptureHook): {
  score: number;
  feedback: string[];
} {
  let score = 50; // Base
  const feedback: string[] = [];

  // Check headline length (8-15 words ideal)
  const wordCount = hook.headline.split(/\s+/).length;
  if (wordCount >= 8 && wordCount <= 15) {
    score += 10;
  } else if (wordCount > 20) {
    score -= 10;
    feedback.push("Headline too long — might lose attention");
  } else if (wordCount < 6) {
    score -= 5;
    feedback.push("Headline might be too short to trigger curiosity");
  }

  // Check for spam words
  const spamWords = ["free", "exclusive", "limited", "amazing", "incredible", "guaranteed"];
  const lower = hook.headline.toLowerCase();
  for (const word of spamWords) {
    if (lower.includes(word)) {
      score -= 15;
      feedback.push(`Contains spam trigger word: "${word}"`);
    }
  }

  // Check for question format (slightly less effective in hooks)
  if (hook.headline.endsWith("?")) {
    score -= 3;
    feedback.push("Statement hooks tend to outperform questions slightly");
  }

  // Check curiosity expansion length
  const expansionWords = hook.curiosityExpansion.split(/\s+/).length;
  if (expansionWords >= 30 && expansionWords <= 80) {
    score += 10;
  } else if (expansionWords > 120) {
    score -= 10;
    feedback.push("Curiosity expansion too long — might lose reader before capture");
  }

  // Check capture prompt for transactional language
  const transactional = ["download", "sign up", "register", "subscribe"];
  for (const word of transactional) {
    if (hook.capturePrompt.toLowerCase().includes(word)) {
      score -= 10;
      feedback.push(`Capture prompt uses transactional language: "${word}"`);
    }
  }

  // Check button text
  if (hook.captureButtonText.toLowerCase().includes("submit")) {
    score -= 15;
    feedback.push("Button text 'submit' is very low-conversion. Use value-oriented text.");
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 70) feedback.unshift("Strong hook — likely effective");
  else if (score >= 50) feedback.unshift("Decent hook — could be improved");
  else feedback.unshift("Weak hook — needs significant revision");

  return { score, feedback };
}
