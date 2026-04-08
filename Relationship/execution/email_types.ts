/**
 * Email Intelligence Module — Shared Types
 *
 * Types for the lead generation, email campaign,
 * and lead capture psychology systems.
 */

import { z } from "zod";

// ─── Prospect Stages ─────────────────────────────────────────

export const ProspectStage = z.enum([
  "cold",              // No prior contact
  "curious",           // Engaged with hook/content
  "interested",        // Responded or clicked
  "considering",       // Actively evaluating
  "ready",             // Ready for conversation
  "converted",         // Booked/purchased
  "dormant",           // Went silent after engagement
]);
export type ProspectStage = z.infer<typeof ProspectStage>;

// ─── Email Campaign Position ─────────────────────────────────

export const CampaignPosition = z.enum([
  "curiosity_trigger",      // Email 1
  "insight_expansion",      // Email 2
  "strategic_perspective",   // Email 3
  "direct_offer",           // Email 4
  "final_close",            // Email 5
]);
export type CampaignPosition = z.infer<typeof CampaignPosition>;

// ─── Prospect Profile ────────────────────────────────────────

export const ProspectProfile = z.object({
  prospectId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  companyName: z.string().optional(),
  companyUrl: z.string().optional(),
  industry: z.string().optional(),
  role: z.string().optional(),
  stage: ProspectStage.default("cold"),
  observations: z.array(z.string()).default([]),
  painPoints: z.array(z.string()).default([]),
  notes: z.string().default(""),
  campaignId: z.string().optional(),
  currentCampaignPosition: CampaignPosition.optional(),
  emailsSent: z.number().default(0),
  emailsOpened: z.number().default(0),
  emailsClicked: z.number().default(0),
  emailsReplied: z.number().default(0),
  lastEmailDate: z.string().optional(),
  firstContactDate: z.string().optional(),
  capturedVia: z.string().optional(),     // How was the lead captured
  tags: z.array(z.string()).default([]),
});
export type ProspectProfile = z.infer<typeof ProspectProfile>;

// ─── Email Strategy (from Sales Intelligence Brain) ──────────

export const EmailStrategy = z.object({
  prospectStage: ProspectStage,
  campaignPosition: CampaignPosition,
  persuasionAngle: z.string(),
  conversionObjective: z.string(),
  callToAction: z.string(),
  toneGuidance: z.string(),
  avoidList: z.array(z.string()),
  subjectLineApproach: z.string(),
});
export type EmailStrategy = z.infer<typeof EmailStrategy>;

// ─── Generated Email ─────────────────────────────────────────

export const GeneratedEmail = z.object({
  subjectLine: z.string(),
  body: z.string(),
  closingName: z.string(),
  strategy: EmailStrategy,
  patternBreakers: z.array(z.string()),
  estimatedReadTime: z.string(),
});
export type GeneratedEmail = z.infer<typeof GeneratedEmail>;

// ─── Email Campaign ──────────────────────────────────────────

export const EmailCampaign = z.object({
  campaignId: z.string(),
  name: z.string(),
  productOrService: z.string(),
  targetAudience: z.string(),
  valueProposition: z.string(),
  companyName: z.string(),
  senderName: z.string(),
  senderRole: z.string(),
  emails: z.array(GeneratedEmail).default([]),
  createdAt: z.string(),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
});
export type EmailCampaign = z.infer<typeof EmailCampaign>;

// ─── Lead Capture Hook ───────────────────────────────────────

export const LeadCaptureHook = z.object({
  hookType: z.enum(["assumption_challenge", "hidden_problem", "counterintuitive", "curiosity_gap"]),
  headline: z.string(),
  curiosityExpansion: z.string(),
  capturePrompt: z.string(),
  captureButtonText: z.string(),
  psychologyNotes: z.string(),
});
export type LeadCaptureHook = z.infer<typeof LeadCaptureHook>;

// ─── Lead Capture Page Content ───────────────────────────────

export const LeadCapturePage = z.object({
  hook: LeadCaptureHook,
  credibilityStatement: z.string(),
  trustTransferLine: z.string(),
  formFields: z.array(z.string()),
  targetEmotion: z.string(),
});
export type LeadCapturePage = z.infer<typeof LeadCapturePage>;

// ─── Email Engine Input ──────────────────────────────────────

export const EmailEngineInput = z.object({
  prospect: ProspectProfile,
  campaignPosition: CampaignPosition,
  productOrService: z.string(),
  valueProposition: z.string(),
  companyName: z.string(),
  senderName: z.string(),
  senderRole: z.string(),
  additionalContext: z.string().optional(),
});
export type EmailEngineInput = z.infer<typeof EmailEngineInput>;

// ─── Email Engine Output ─────────────────────────────────────

export const EmailEngineOutput = z.object({
  email: GeneratedEmail,
  prospectUpdates: z.record(z.unknown()).optional(),
  nextAction: z.string(),
  suggestedDelay: z.number(),  // Days until next email
});
export type EmailEngineOutput = z.infer<typeof EmailEngineOutput>;
