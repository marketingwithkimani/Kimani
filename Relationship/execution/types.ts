/**
 * Relationship AI Operating System — Shared Types
 */

import { z } from "zod";

// ─── Intent Stages ───────────────────────────────────────────
export const IntentStage = z.enum([
  "curiosity",
  "exploration",
  "evaluation",
  "consideration",
  "purchase_readiness",
  "conversion",
  "long_term_relationship",
]);
export type IntentStage = z.infer<typeof IntentStage>;

// ─── Response Modes ──────────────────────────────────────────
export const ResponseMode = z.enum([
  "curious",
  "reflective",
  "observational",
  "analytical",
  "personal_advisor",
  "casual_commentary",
  "minimal",
  "story",
]);
export type ResponseMode = z.infer<typeof ResponseMode>;

// ─── Emotional State ─────────────────────────────────────────
export const EmotionalState = z.enum([
  "neutral",
  "positive",
  "excited",
  "anxious",
  "frustrated",
  "confused",
  "sad",
  "stressed",
  "hopeful",
  "curious",
  "interested",
]);
export type EmotionalState = z.infer<typeof EmotionalState>;

// ─── Intent Analysis Result ──────────────────────────────────
export const IntentAnalysis = z.object({
  intentScore: z.number().min(0).max(100),
  stage: IntentStage,
  emotion: EmotionalState,
  buyingSignals: z.array(z.string()),
  suggestedMove: z.string(),
  avoid: z.string(),
  decisionReadiness: z.number().min(0).max(100),
  knowledgeLevel: z.enum(["beginner", "intermediate", "advanced"]),
});
export type IntentAnalysis = z.infer<typeof IntentAnalysis>;

// ─── Variability Directive ───────────────────────────────────
export const VariabilityDirective = z.object({
  mode: ResponseMode,
  lengthGuidance: z.enum(["minimal", "short", "medium", "long"]),
  toneShift: z.string(),
  patternBreakers: z.array(z.string()),
});
export type VariabilityDirective = z.infer<typeof VariabilityDirective>;

// ─── Client Memory Profile ──────────────────────────────────
export const ClientProfile = z.object({
  clientId: z.string(),
  name: z.string().optional(),
  age: z.string().optional(),
  profession: z.string().optional(),
  goals: z.array(z.string()).default([]),
  challenges: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  financialConcerns: z.array(z.string()).default([]),
  healthConcerns: z.array(z.string()).default([]),
  familyReferences: z.array(z.string()).default([]),
  lifeEvents: z.array(z.string()).default([]),
  preferredTone: z.string().default("friendly"),
  previousQuestions: z.array(z.string()).default([]),
  timelineEvents: z.array(
    z.object({
      event: z.string(),
      approximateDate: z.string(),
      followedUp: z.boolean().default(false),
    })
  ).default([]),
  intentHistory: z.array(
    z.object({
      date: z.string(),
      score: z.number(),
      stage: IntentStage,
    })
  ).default([]),
  lastContactDate: z.string().optional(),
  conversationCount: z.number().default(0),
  messageCount: z.number().default(0),
  disclosureLevel: z.number().default(0),
  country: z.string().optional(),
  notes: z.string().default(""),
});
export type ClientProfile = z.infer<typeof ClientProfile>;

// ─── Conversation Message ────────────────────────────────────
export const ConversationMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
});
export type ConversationMessage = z.infer<typeof ConversationMessage>;

// ─── Personality Config ──────────────────────────────────────
export const PersonalityConfig = z.object({
  name: z.string(),
  curiosityLevel: z.number().min(1).max(10),
  humorStyle: z.enum(["dry", "warm", "playful"]),
  energy: z.enum(["calm", "moderate", "energetic"]),
  empathyLevel: z.number().min(1).max(10),
  advisoryStyle: z.enum([
    "thoughtful_advisor",
    "calm_strategist",
    "friendly_guide",
    "insightful_analyst",
    "trust_driven_strategist",
  ]),
  bio: z.string().optional(),
  credentials: z.array(z.string()).optional(),
  differentiators: z.array(z.string()).optional(),
  contactEmail: z.string().optional(),
  website: z.string().optional(),
});
export type PersonalityConfig = z.infer<typeof PersonalityConfig>;

// ─── Full AI Engine Input ────────────────────────────────────
export const AIEngineInput = z.object({
  clientId: z.string(),
  message: z.string(),
  conversationHistory: z.array(ConversationMessage).default([]),
});
export type AIEngineInput = z.infer<typeof AIEngineInput>;

// ─── Full AI Engine Output ───────────────────────────────────
export const AIEngineOutput = z.object({
  response: z.string(),
  intentAnalysis: IntentAnalysis,
  variabilityDirective: VariabilityDirective,
  discoverySummary: z.string().optional(),
  suggestedNextAction: z.string().optional(),
  memoryUpdates: z.record(z.unknown()).optional(),
  scheduledFollowUps: z.array(
    z.object({
      message: z.string(),
      delayDays: z.number(),
      reason: z.string(),
    })
  ).default([]),
});
export type AIEngineOutput = z.infer<typeof AIEngineOutput>;

// ─── Dashboard Lead Entity ────────────────────────────────────
export interface DashboardLead {
  sessionId: string;
  name: string;
  company: string;
  profession: string;
  country: string;
  stage: IntentStage;
  intentScore: number;
  discoverySummary: string;
  suggestedNextAction: string;
  fullConversation: ConversationMessage[];
  lastInteraction: string;
  capturedVia: string;
}
