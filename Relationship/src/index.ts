/**
 * Relationship AI Operating System — Entry Point
 *
 * Exports the main handler and all subsystem modules
 * for use via Trigger.dev tasks, webhooks, or direct invocation.
 */

export { handleMessage } from "../execution/conversation_handler.js";
export { analyzeIntent, detectIntentDrop, isConversionReady } from "../execution/intent_analyzer.js";
export { generateVariabilityDirective, resetVariabilityState } from "../execution/variability_engine.js";
export { generateResponse } from "../execution/ai_engine.js";
export {
  loadClientProfile,
  saveClientProfile,
  createBlankProfile,
  logConversationMessage,
  loadConversationHistory,
  initializeSpreadsheet,
} from "../execution/memory_store.js";
export {
  scheduleFollowUp,
  scheduleInactivityCheck,
  scheduledFollowUp,
  inactivityMonitor,
} from "../execution/proactive_engine.js";
export {
  calculateMomentum,
  resetMomentumState,
} from "../execution/momentum_engine.js";
export type { MomentumState, EngagementSignal } from "../execution/momentum_engine.js";

// ─── Email Intelligence Module ──────────────────────────────
export {
  generateEmail,
  generateFullCampaign,
} from "../execution/email_engine.js";
export {
  generateLeadCapture,
  generateHookVariants,
  scoreHook,
} from "../execution/lead_capture.js";
export {
  loadProspect,
  saveProspect,
  createCampaign,
  sendNextInSequence,
  updateProspectStage,
  shouldTransitionToConversation,
  initializeEmailSheets,
} from "../execution/email_campaign.js";
export * from "../execution/email_types.js";

// Re-export all types
export * from "../execution/types.js";

console.log("Relationship AI Operating System — Ready.");
