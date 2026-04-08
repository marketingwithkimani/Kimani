/**
 * Conversation Handler — Inbound Message Router
 *
 * This is the main entry point for processing client messages.
 * It ties all 7 subsystems together in the correct order:
 *
 * 1. Load client memory
 * 2. Analyze intent (Sales Intelligence Brain)
 * 3. Calculate conversation momentum
 * 4. Generate variability directive
 * 5. Generate response (AI Engine / Relationship Brain)
 * 6. Update client memory
 * 7. Schedule follow-ups (Proactive Engine)
 * 8. Log conversation
 */

import { AIEngineInput, AIEngineOutput, ClientProfile } from "./types.js";
import {
  loadClientProfile,
  saveClientProfile,
  createBlankProfile,
  logConversationMessage,
  loadConversationHistory,
} from "./memory_store.js";
import { analyzeIntent, detectIntentDrop } from "./intent_analyzer.js";
import { generateVariabilityDirective } from "./variability_engine.js";
import { generateResponse } from "./ai_engine.js";
import { calculateMomentum } from "./momentum_engine.js";
import {
  scheduleFollowUp,
  scheduleInactivityCheck,
} from "./proactive_engine.js";

// ─── Core Handler ────────────────────────────────────────────

/**
 * Process an inbound client message through the full pipeline.
 *
 * This is the function webhooks and integrations should call.
 */
export async function handleMessage(
  input: AIEngineInput
): Promise<AIEngineOutput> {
  const { clientId, message } = input;
  const timestamp = new Date().toISOString();

  console.log(`\n─── Processing message from ${clientId} ───`);
  console.log(`Message: "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}"`);

  // ── Step 1: Load client memory ──
  let clientProfile = await loadClientProfile(clientId);
  const isNewClient = !clientProfile;

  if (!clientProfile) {
    console.log("New client detected. Creating blank profile.");
    clientProfile = createBlankProfile(clientId);
  }

  // ── Step 2: Load conversation history ──
  let conversationHistory = input.conversationHistory;
  if (conversationHistory.length === 0) {
    conversationHistory = await loadConversationHistory(clientId, 20);
  }

  // ── Step 3: Analyze intent (Sales Intelligence Brain) ──
  console.log("Running intent analysis...");
  const intentAnalysis = await analyzeIntent(
    message,
    conversationHistory,
    clientProfile
  );
  console.log(
    `Intent: score=${intentAnalysis.intentScore}, stage=${intentAnalysis.stage}, emotion=${intentAnalysis.emotion}`
  );

  // Check for intent drop — if the user is pulling back, the AI should back off
  if (detectIntentDrop(clientProfile)) {
    console.log("⚠ Intent drop detected. Backing off sales pressure.");
    intentAnalysis.suggestedMove =
      "Back off. Return to relationship building. Ask about them personally.";
    intentAnalysis.avoid = "Any sales language, product mentions, or conversion attempts.";
  }

  // ── Step 4: Calculate conversation momentum ──
  const momentum = calculateMomentum(
    message,
    conversationHistory,
    intentAnalysis
  );
  console.log(
    `Momentum: score=${momentum.score}, trend=${momentum.trend}, energy=${momentum.energyRecommendation}`
  );

  // ── Step 5: Generate variability directive ──
  const variability = generateVariabilityDirective(
    intentAnalysis,
    conversationHistory
  );
  console.log(
    `Variability: mode=${variability.mode}, length=${variability.lengthGuidance}`
  );

  // ── Step 6: Generate response (AI Engine) ──
  console.log("Generating response via AI Engine...");
  const engineResult = await generateResponse(
    message,
    conversationHistory,
    clientProfile,
    intentAnalysis,
    variability,
    momentum
  );

  // ── Step 7: Update client memory ──
  const updatedProfile = applyMemoryUpdates(
    clientProfile,
    engineResult.memoryUpdates,
    intentAnalysis,
    timestamp
  );

  await saveClientProfile(updatedProfile);
  console.log("Client profile updated.");

  // ── Step 7: Log conversation messages ──
  await logConversationMessage(clientId, {
    role: "user",
    content: message,
    timestamp,
  });

  await logConversationMessage(clientId, {
    role: "assistant",
    content: engineResult.response,
    timestamp: new Date().toISOString(),
  });

  // ── Step 8: Schedule follow-ups ──
  for (const followUp of engineResult.scheduledFollowUps) {
    try {
      await scheduleFollowUp(
        clientId,
        followUp.message,
        followUp.delayDays,
        followUp.reason,
        "timeline"
      );
    } catch (error) {
      console.error("Failed to schedule follow-up:", error);
      // Non-critical — don't block the response
    }
  }

  // Schedule inactivity check
  try {
    await scheduleInactivityCheck(clientId, timestamp);
  } catch (error) {
    console.error("Failed to schedule inactivity check:", error);
  }

  console.log(`─── Response ready for ${clientId} ───\n`);

  // ── Build output ──
  return {
    response: engineResult.response,
    intentAnalysis,
    variabilityDirective: variability,
    memoryUpdates: engineResult.memoryUpdates,
    scheduledFollowUps: engineResult.scheduledFollowUps,
  };
}

// ─── Memory Update Logic ─────────────────────────────────────

/**
 * Apply memory updates extracted by the AI Engine to the client profile.
 */
function applyMemoryUpdates(
  profile: ClientProfile,
  updates: Record<string, unknown>,
  intentAnalysis: { intentScore: number; stage: string },
  timestamp: string
): ClientProfile {
  const updated = { ...profile };

  // Update simple string fields
  if (updates.name && typeof updates.name === "string") {
    updated.name = updates.name;
  }
  if (updates.age && typeof updates.age === "string") {
    updated.age = updates.age;
  }
  if (updates.profession && typeof updates.profession === "string") {
    updated.profession = updates.profession;
  }
  if (updates.preferredTone && typeof updates.preferredTone === "string") {
    updated.preferredTone = updates.preferredTone;
  }
  if (updates.notes && typeof updates.notes === "string") {
    updated.notes = updated.notes
      ? `${updated.notes}\n${updates.notes}`
      : (updates.notes as string);
  }

  // Merge array fields (deduplicate)
  const arrayFields = [
    "goals",
    "challenges",
    "interests",
    "financialConcerns",
    "healthConcerns",
    "familyReferences",
    "lifeEvents",
    "previousQuestions",
  ] as const;

  for (const field of arrayFields) {
    if (updates[field] && Array.isArray(updates[field])) {
      const existing = new Set(updated[field]);
      for (const item of updates[field] as string[]) {
        existing.add(item);
      }
      updated[field] = Array.from(existing);
    }
  }

  // Merge timeline events
  if (updates.timelineEvents && Array.isArray(updates.timelineEvents)) {
    const existingEvents = new Set(
      updated.timelineEvents.map((e) => e.event.toLowerCase())
    );
    for (const event of updates.timelineEvents as ClientProfile["timelineEvents"]) {
      if (!existingEvents.has(event.event.toLowerCase())) {
        updated.timelineEvents.push(event);
      }
    }
  }

  // Update intent history
  updated.intentHistory.push({
    date: timestamp,
    score: intentAnalysis.intentScore,
    stage: intentAnalysis.stage as ClientProfile["intentHistory"][0]["stage"],
  });

  // Keep only the last 20 intent records
  if (updated.intentHistory.length > 20) {
    updated.intentHistory = updated.intentHistory.slice(-20);
  }

  // Update metadata
  updated.lastContactDate = timestamp;
  updated.conversationCount += 1;

  return updated;
}

// ─── Simple Test / CLI Mode ──────────────────────────────────

/**
 * Quick test for the conversation handler.
 * Run directly: npx tsx execution/conversation_handler.ts
 */
async function main() {
  const testInput: AIEngineInput = {
    clientId: "test-client-001",
    message: "Hey, I've been thinking about investing lately but I'm not sure where to start.",
    conversationHistory: [],
  };

  try {
    const result = await handleMessage(testInput);
    console.log("\n═══ RESULT ═══");
    console.log("Response:", result.response);
    console.log("\nIntent:", JSON.stringify(result.intentAnalysis, null, 2));
    console.log("Variability:", JSON.stringify(result.variabilityDirective, null, 2));
    console.log("Memory Updates:", JSON.stringify(result.memoryUpdates, null, 2));
    console.log("Follow-ups:", JSON.stringify(result.scheduledFollowUps, null, 2));
  } catch (error) {
    console.error("Handler failed:", error);
  }
}

// Run if executed directly
const isMainModule = process.argv[1]?.endsWith("conversation_handler.ts");
if (isMainModule) {
  main();
}

export { applyMemoryUpdates };
