/**
 * Proactive Relationship Engine
 *
 * Handles scheduled follow-ups using Trigger.dev delayed tasks.
 * This system keeps relationships alive between active conversations.
 *
 * It schedules:
 * - Timeline-based follow-ups (events the client mentioned)
 * - Inactivity check-ins (if client goes silent 7+ days)
 * - Contextual follow-ups (based on conversation content)
 */

import { task, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";

// ─── Schemas ─────────────────────────────────────────────────

const FollowUpPayload = z.object({
  clientId: z.string(),
  message: z.string(),
  reason: z.string(),
  type: z.enum(["timeline", "inactivity", "contextual"]),
});

type FollowUpPayload = z.infer<typeof FollowUpPayload>;

// ─── Follow-Up Templates ────────────────────────────────────

const INACTIVITY_TEMPLATES = [
  "Hey — hope things are going well. Anything new on your end?",
  "Random thought — been a little while since we chatted. How are things going?",
  "Hey, just checking in. No agenda, just curious how things are going.",
  "Hope everything's good on your end. Anything I can help with?",
  "Been a bit — anything happen with [context]?",
];

const TIMELINE_TEMPLATES = [
  "Hey — you mentioned [event] was coming up. How did that go?",
  "Random thought — last time we talked you were [context]. Did that end up happening?",
  "Quick question — did [event] work out?",
  "Hey, I remembered you had [event] coming up. How'd it go?",
];

// ─── Helper ──────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Trigger.dev Tasks ──────────────────────────────────────

/**
 * Scheduled follow-up task.
 * This runs after a delay and sends a proactive message to the client.
 */
export const scheduledFollowUp = task({
  id: "scheduled-follow-up",
  run: async (payload: FollowUpPayload) => {
    const validated = FollowUpPayload.parse(payload);

    // Generate the follow-up message based on type
    let messageTemplate: string;

    switch (validated.type) {
      case "inactivity":
        messageTemplate = pickRandom(INACTIVITY_TEMPLATES);
        break;
      case "timeline":
        messageTemplate = pickRandom(TIMELINE_TEMPLATES);
        break;
      case "contextual":
        messageTemplate = validated.message;
        break;
    }

    // Replace placeholders with context from the payload
    const finalMessage = messageTemplate
      .replace("[event]", validated.reason)
      .replace("[context]", validated.reason);

    // Return the generated follow-up for the webhook to deliver
    return {
      clientId: validated.clientId,
      message: finalMessage,
      type: validated.type,
      reason: validated.reason,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Inactivity monitor task.
 * Checks if a client has been inactive and triggers a check-in.
 */
export const inactivityMonitor = task({
  id: "inactivity-monitor",
  run: async (payload: { clientId: string; lastContactDate: string }) => {
    const lastContact = new Date(payload.lastContactDate);
    const now = new Date();
    const daysSinceContact = Math.floor(
      (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceContact >= 7) {
      return {
        shouldFollowUp: true,
        clientId: payload.clientId,
        daysSinceContact,
        suggestedMessage: pickRandom(INACTIVITY_TEMPLATES),
      };
    }

    return {
      shouldFollowUp: false,
      clientId: payload.clientId,
      daysSinceContact,
    };
  },
});

// ─── Public Scheduling API ──────────────────────────────────

/**
 * Schedule a follow-up for a client.
 * Uses Trigger.dev delayed execution.
 */
export async function scheduleFollowUp(
  clientId: string,
  message: string,
  delayDays: number,
  reason: string,
  type: "timeline" | "inactivity" | "contextual" = "contextual"
): Promise<string> {
  const handle = await scheduledFollowUp.trigger(
    {
      clientId,
      message,
      reason,
      type,
    },
    {
      delay: `${delayDays}d`,
    }
  );

  console.log(
    `Scheduled ${type} follow-up for client ${clientId} in ${delayDays} days. Run ID: ${handle.id}`
  );

  return handle.id;
}

/**
 * Schedule an inactivity check for a client.
 */
export async function scheduleInactivityCheck(
  clientId: string,
  lastContactDate: string
): Promise<string> {
  // Check 7 days after last contact
  const handle = await inactivityMonitor.trigger(
    {
      clientId,
      lastContactDate,
    },
    {
      delay: "7d",
    }
  );

  console.log(
    `Scheduled inactivity check for client ${clientId}. Run ID: ${handle.id}`
  );

  return handle.id;
}
