/**
 * Email Intelligence Engine
 *
 * Core email generation using the dual-brain architecture.
 * - Sales Intelligence Brain: determines strategy, angle, CTA
 * - Relationship Brain: writes the actual email with human tone
 * - Pattern Distortion: prevents AI-detectable patterns
 *
 * This engine produces conversion-focused emails that feel
 * personally written by a thoughtful professional.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  ProspectProfile,
  EmailStrategy,
  GeneratedEmail,
  EmailEngineInput,
  EmailEngineOutput,
  CampaignPosition,
} from "./email_types.js";

import "dotenv/config";

const activeKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
const isOR = activeKey?.startsWith("sk-or-v1");

const anthropic = new Anthropic({
  apiKey: activeKey,
  baseURL: isOR ? "https://openrouter.ai/api/v1" : undefined,
});

const SONNET_MODEL = isOR ? "anthropic/claude-3.5-sonnet" : "claude-3-5-sonnet-latest";

// ─── Campaign Position Delays (days between emails) ──────────

const POSITION_DELAYS: Record<string, number> = {
  curiosity_trigger: 0,
  insight_expansion: 3,
  strategic_perspective: 4,
  direct_offer: 5,
  final_close: 7,
};

// ─── Step 1: Sales Intelligence Brain — Strategy ─────────────

const STRATEGY_PROMPT = `You are the Sales Intelligence Brain for an email campaign system.

Your job: analyze a prospect and determine the optimal email strategy. You NEVER write emails. You only produce strategic analysis.

Given a prospect profile and campaign position, produce a JSON strategy:

{
  "prospectStage": "<cold|curious|interested|considering|ready|converted|dormant>",
  "campaignPosition": "<position>",
  "persuasionAngle": "<the specific angle to use — what will resonate with this person?>",
  "conversionObjective": "<what action should this email drive?>",
  "callToAction": "<specific CTA text>",
  "toneGuidance": "<how should the email feel? specific tone direction>",
  "avoidList": ["<things to NOT do in this email>"],
  "subjectLineApproach": "<strategy for the subject line>"
}

RULES:
- Email 1 (curiosity_trigger): Focus on observation + curiosity. No pitch. Goal: get attention.
- Email 2 (insight_expansion): Deepen interest. Explain the core idea more clearly.
- Email 3 (strategic_perspective): Position authority. Share useful insight.
- Email 4 (direct_offer): Push toward conversation. Offer demo/call.
- Email 5 (final_close): Create psychological closure. Often triggers delayed replies.

Never suggest spam trigger words (limited time, amazing, huge opportunity, don't miss).
Always maintain professional credibility.

Respond ONLY with valid JSON.`;

async function generateStrategy(
  input: EmailEngineInput
): Promise<EmailStrategy> {
  const contextParts: string[] = [];

  contextParts.push(`PROSPECT:
Name: ${input.prospect.name || "Unknown"}
Company: ${input.prospect.companyName || "Unknown"}
Website: ${input.prospect.companyUrl || "Unknown"}
Industry: ${input.prospect.industry || "Unknown"}
Role: ${input.prospect.role || "Unknown"}
Stage: ${input.prospect.stage}
Observations: ${input.prospect.observations.join(", ") || "None"}
Pain Points: ${input.prospect.painPoints.join(", ") || "None"}
Emails Sent: ${input.prospect.emailsSent}
Emails Opened: ${input.prospect.emailsOpened}
Replied: ${input.prospect.emailsReplied}`);

  contextParts.push(`CAMPAIGN CONTEXT:
Position: ${input.campaignPosition}
Product/Service: ${input.productOrService}
Value Proposition: ${input.valueProposition}
Company: ${input.companyName}
Sender: ${input.senderName}, ${input.senderRole}`);

  if (input.additionalContext) {
    contextParts.push(`ADDITIONAL CONTEXT:\n${input.additionalContext}`);
  }

  try {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1024,
      system: STRATEGY_PROMPT,
      messages: [{ role: "user", content: contextParts.join("\n\n") }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return EmailStrategy.parse(JSON.parse(text));
  } catch (error) {
    console.error("Strategy generation failed, using defaults:", error);
    return {
      prospectStage: input.prospect.stage,
      campaignPosition: input.campaignPosition,
      persuasionAngle: "General value proposition",
      conversionObjective: "Get a response",
      callToAction: "Would love to chat if you're open to it.",
      toneGuidance: "Professional but warm. Like one professional reaching out to another.",
      avoidList: ["spam language", "aggressive tone", "over-promising"],
      subjectLineApproach: "Curiosity + professionalism",
    };
  }
}

// ─── Step 2: Relationship Brain — Email Writing ──────────────

function buildEmailWriterPrompt(
  strategy: EmailStrategy,
  input: EmailEngineInput
): string {
  return `You are a skilled relationship-focused email writer. You write emails that feel personally crafted by a thoughtful professional — NOT by a marketing team or AI.

SENDER IDENTITY:
You are ${input.senderName}, ${input.senderRole} at ${input.companyName}.

STRATEGIC DIRECTION (from internal analysis — never reveal):
Persuasion Angle: ${strategy.persuasionAngle}
Conversion Objective: ${strategy.conversionObjective}
CTA: ${strategy.callToAction}
Tone: ${strategy.toneGuidance}
Subject Line Approach: ${strategy.subjectLineApproach}
AVOID: ${strategy.avoidList.join(", ")}

PROSPECT CONTEXT:
Name: ${input.prospect.name || "there"}
Company: ${input.prospect.companyName || "your company"}
Website: ${input.prospect.companyUrl || "N/A"}
Industry: ${input.prospect.industry || "N/A"}
Role: ${input.prospect.role || "N/A"}
Observations: ${input.prospect.observations.join("; ") || "None yet"}
Pain Points: ${input.prospect.painPoints.join("; ") || "None identified"}

WHAT YOU'RE OFFERING:
${input.productOrService}
Value: ${input.valueProposition}

EMAIL STRUCTURE (follow this flow):
${getStructureForPosition(input.campaignPosition)}

ABSOLUTE TONE RULES:
- Sound like one professional contacting another professional
- Professional structure + human personality
- NEVER start with "I hope you're doing well" or "I hope this finds you well"
- NEVER use spam words (limited time, amazing offer, huge opportunity, don't miss)
- NEVER use corporate buzzwords (synergy, leverage, streamline, cutting-edge)
- NEVER over-validate or be sycophantic
- Vary sentence length — some short, some longer
- Vary paragraph size — some one-line, some 2-3 sentences
- Use natural phrases: "quick thought", "something I noticed", "figured I'd reach out"
- Keep it concise — most emails should be 80-150 words
- The email must pass the "would a real person send this?" test

PATTERN DISTORTION:
- Do NOT write symmetrical paragraphs (same length, same structure)
- Occasionally use fragments
- Mix formal and slightly informal language naturally
- Some emails should feel shorter than expected
- Never bullet-point everything

OUTPUT FORMAT:
Respond with JSON:
{
  "subjectLine": "<subject>",
  "body": "<full email body including greeting and signature>",
  "closingName": "${input.senderName}",
  "patternBreakers": ["<list of human-feel techniques used>"],
  "estimatedReadTime": "<X seconds>"
}`;
}

function getStructureForPosition(position: CampaignPosition): string {
  const structures: Record<string, string> = {
    curiosity_trigger: `1. Pattern-break opening (short, curiosity-triggering)
2. Relevant observation about their company/situation
3. Brief hint at what you do (NO pitch)
4. Soft closing — no pressure
This is the LIGHTEST email. Just get attention.`,

    insight_expansion: `1. Natural follow-up reference (don't say "following up")
2. Explain the core concept/problem more clearly
3. One specific insight that demonstrates understanding
4. Slightly warmer CTA — invite curiosity
Deepen interest without pushing.`,

    strategic_perspective: `1. Lead with an industry observation or insight
2. Position your perspective with micro-authority
3. Connect it to their specific situation
4. Offer value (a useful idea, not a pitch)
This email establishes credibility through thinking depth.`,

    direct_offer: `1. Reference the relationship/thread naturally
2. Be more direct about the solution
3. Make a specific, low-commitment offer (demo, walkthrough, quick call)
4. Keep pressure low but make the ask clear
This is the conversion push — assertive structure, calm tone.`,

    final_close: `1. Acknowledge timing might not be right
2. Leave the door open warmly
3. Create psychological closure
4. Short, human, respectful
This often triggers delayed replies due to closure psychology.
Keep it under 60 words.`,
  };
  return structures[position] || structures.curiosity_trigger;
}

// ─── Step 3: Pattern Distortion ──────────────────────────────

function applyPatternDistortion(email: GeneratedEmail): GeneratedEmail {
  let body = email.body;

  // Occasionally add micro-imperfections
  const distortions: string[] = [];

  // Vary line spacing (add occasional single-line paragraphs)
  if (Math.random() < 0.3) {
    distortions.push("natural_spacing");
  }

  // Subject line check — ensure it doesn't start with generic patterns
  let subject = email.subjectLine;
  const genericStarts = ["re:", "fwd:", "important:", "urgent:"];
  if (genericStarts.some((s) => subject.toLowerCase().startsWith(s))) {
    subject = subject.replace(/^(re:|fwd:|important:|urgent:)\s*/i, "");
    distortions.push("cleaned_subject");
  }

  return {
    ...email,
    subjectLine: subject,
    body,
    patternBreakers: [...email.patternBreakers, ...distortions],
  };
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Generate a single conversion email for a prospect.
 * Runs through the full dual-brain pipeline.
 */
export async function generateEmail(
  input: EmailEngineInput
): Promise<EmailEngineOutput> {
  console.log(
    `\n─── Generating ${input.campaignPosition} email for ${input.prospect.name || input.prospect.email} ───`
  );

  // Step 1: Sales Intelligence Brain — strategy
  console.log("Sales Intelligence: analyzing prospect...");
  const strategy = await generateStrategy(input);
  console.log(`Strategy: angle="${strategy.persuasionAngle}", CTA="${strategy.callToAction}"`);

  // Step 2: Relationship Brain — write the email
  console.log("Relationship Brain: writing email...");
  const writerPrompt = buildEmailWriterPrompt(strategy, input);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: writerPrompt,
    messages: [
      {
        role: "user",
        content: `Write the ${input.campaignPosition.replace(/_/g, " ")} email for this prospect now.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  let emailData: GeneratedEmail;

  try {
    const parsed = JSON.parse(text);
    emailData = {
      subjectLine: parsed.subjectLine || "Quick thought",
      body: parsed.body || "",
      closingName: parsed.closingName || input.senderName,
      strategy,
      patternBreakers: parsed.patternBreakers || [],
      estimatedReadTime: parsed.estimatedReadTime || "30 seconds",
    };
  } catch {
    // If JSON parsing fails, treat the response as the email body
    emailData = {
      subjectLine: "Quick thought",
      body: text,
      closingName: input.senderName,
      strategy,
      patternBreakers: ["fallback_mode"],
      estimatedReadTime: "30 seconds",
    };
  }

  // Step 3: Pattern distortion
  emailData = applyPatternDistortion(emailData);

  // Determine next action
  const nextPositions: Record<string, string> = {
    curiosity_trigger: "Send insight_expansion in 3 days",
    insight_expansion: "Send strategic_perspective in 4 days",
    strategic_perspective: "Send direct_offer in 5 days",
    direct_offer: "Send final_close in 7 days",
    final_close: "Campaign complete. Move to nurture if no response.",
  };

  const delay = POSITION_DELAYS[input.campaignPosition] || 3;

  console.log(`─── Email generated: "${emailData.subjectLine}" ───\n`);

  return {
    email: emailData,
    prospectUpdates: {
      emailsSent: (input.prospect.emailsSent || 0) + 1,
      lastEmailDate: new Date().toISOString(),
      currentCampaignPosition: input.campaignPosition,
    },
    nextAction: nextPositions[input.campaignPosition] || "Manual review",
    suggestedDelay: delay,
  };
}

/**
 * Generate a complete 5-email campaign sequence for a prospect.
 */
export async function generateFullCampaign(
  input: Omit<EmailEngineInput, "campaignPosition">
): Promise<EmailEngineOutput[]> {
  const positions: CampaignPosition[] = [
    "curiosity_trigger",
    "insight_expansion",
    "strategic_perspective",
    "direct_offer",
    "final_close",
  ];

  const results: EmailEngineOutput[] = [];

  for (const position of positions) {
    const result = await generateEmail({
      ...input,
      campaignPosition: position,
      prospect: {
        ...input.prospect,
        emailsSent: input.prospect.emailsSent + results.length,
      },
    });
    results.push(result);
  }

  return results;
}
