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
import axios from "axios";

// ─── Lazy Client Factory ─────────────────────────────────────
function getAnthropicClient() {
  const activeKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
  const isOR = activeKey?.startsWith("sk-or-v1");
  
  if (isOR) {
    return {
      client: {
        messages: {
          create: async (params: any) => {
            const response = await axios.post(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                model: "anthropic/claude-sonnet-4.6",
                messages: params.messages.map((m: any) => ({
                  role: m.role,
                  content: m.content
                })),
                system: params.system,
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
      model: "anthropic/claude-sonnet-4.6",
    };
  }

  return {
    client: new Anthropic({
      apiKey: activeKey,
    }),
    model: "claude-3-5-sonnet-latest",
  };
}

// ─── Campaign Position Delays (days between emails) ──────────

const POSITION_DELAYS: Record<string, number> = {
  curiosity_trigger: 0,
  insight_expansion: 3,
  strategic_perspective: 4,
  direct_offer: 5,
  final_close: 7,
};

// ─── Step 1: Sales Intelligence Brain — Strategy ─────────────

const STRATEGY_PROMPT = `You are a high-level Sales Intelligence Strategist. 

Your philosophy is a hybrid of:
- Don Draper: Emotional, evocative, focusing on the "quiet realization."
- Myron Golden: Transformation-focused, value clarity, logical decision framing.
- African-Aware: Simple, relatable, avoiding over-polished "Western" marketing hype.

Your job: Analyze a prospect and determine the optimal strategic angle. You NEVER write emails. You only produce strategic analysis.

Given a prospect profile and campaign position, produce a JSON strategy:

{
  "prospectStage": "cold|curiosity|exploration|evaluation|consideration|ready|converted",
  "painHook": "<What is the one specific observation or pain point that will trigger immediate recognition?>",
  "abtNarrative": {
    "and": "<The current context or desire they have>",
    "but": "<The real problem or barrier holding them back>",
    "therefore": "<The transformation or logical next step we provide>"
  },
  "oneBelief": "<The single belief they must internalize (e.g., 'Lead loss is the real problem, not lead gen')>",
  "persuasionAngle": "<The emotional 'Don Draper' hook>",
  "conversionObjective": "<Transformation goal>",
  "callToAction": "<The 'Push-Pull' closing logic (e.g., 'Not sure if you're ready, but if so...')>",
  "toneGuidance": "Clear, Emotional, Calm confidence, Human",
  "avoidList": ["corporate jargon", "polished Western tone", "asking for a meeting too early"]
}

Respond ONLY with valid JSON.`;

async function generateStrategy(
  input: EmailEngineInput
): Promise<EmailStrategy> {
  const contextParts: string[] = [];

  contextParts.push(`PROSPECT:
Name: ${input.prospect.name || "Unknown"}
Company: ${input.prospect.companyName || "Unknown"}
Observations: ${input.prospect.observations.join(", ") || "None"}
Pain Points: ${input.prospect.painPoints.join(", ") || "None"}`);

  contextParts.push(`CAMPAIGN CONTEXT:
Position: ${input.campaignPosition}
Value Proposition: ${input.valueProposition}
Sender: ${input.senderName}, ${input.senderRole}`);

  try {
    const { client: anthropic, model } = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 1024,
      system: STRATEGY_PROMPT,
      messages: [{ role: "user", content: contextParts.join("\n\n") }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text);
  } catch (error) {
    console.error("Strategy generation failed, using defaults:", error);
    return {
      prospectStage: input.prospect.stage,
      painHook: "Leads going quiet",
      abtNarrative: { and: "getting leads", but: "they disappear", therefore: "nurture system" },
      oneBelief: "Lead loss is the real problem",
      persuasionAngle: "Building lasting systems",
      conversionObjective: "Insight recognition",
      callToAction: "If you're ready, let's talk. If not, no pressure.",
      toneGuidance: "Human and calm",
      avoidList: ["marketing hype", "corporate jargon"],
      subjectLineApproach: "Pain + Curiosity"
    } as any;
  }
}

// ─── Step 2: Relationship Brain — Email Writing ──────────────

function buildEmailWriterPrompt(
  strategy: any,
  input: EmailEngineInput
): string {
  return `You are a world-class relationship-focused copywriter. You write emails that feel personally crafted by a thoughtful professional — NOT by a system.

CORE VOICE:
- Tone: ${strategy.toneGuidance} (Clear, Emotional, Calm confidence, Human)
- Philosophy: 70% Professional / 30% Relaxed. Simple English. No hype.
- NEVER start with "I hope you're doing well."
- AVOID: Corporate jargon, polished Western marketing tone.

MANDATORY EMAIL STRUCTURE (FOLLOW THIS):
1. SUBJECT LINE: PAIN + CURIOSITY (Short, direct, no hype. E.g., "Quick one — do your leads go quiet?")
2. OPENING: HUMAN ENTRY (Casual, respectful. E.g., "Hey — quick one 🙂")
3. PAIN-FIRST HOOK: Trigger recognition by stating what they are missing/doing wrong.
4. ABT NARRATIVE:
   - AND: ${strategy.abtNarrative.and}
   - BUT: ${strategy.abtNarrative.but}
   - THEREFORE: ${strategy.abtNarrative.therefore}
5. ONE BELIEF (IMPLICIT): Communicate that ${strategy.oneBelief}.
6. MECHANISM: Describe how it works simply (No AI/technical jargon).
7. COST OF NO: Subtle reality check (E.g., "Every day they don't hear from you, they move on").
8. PUSH-PULL CLOSE: ${strategy.callToAction} (Calm detachment. No pressure).

PROSPECT CONTEXT:
Name: ${input.prospect.name || "there"}
Company: ${input.prospect.companyName || "your company"}
Observations: ${strategy.painHook}

SENDER:
Name: ${input.senderName}
Role: ${input.senderRole} at ${input.companyName}

OUTPUT FORMAT:
Respond with JSON:
{
  "subjectLine": "<subject>",
  "body": "<full email body>",
  "closingName": "${input.senderName}"
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
  const { client: anthropic, model } = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: model,
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
