# Email Intelligence Module — Strategy & Execution

## Goal
Convert prospects into leads and leads into customers using a psychologically fueled lead capture system and a dual-brain email generation engine.

## Architecture Overvew

The module consists of three primary layers:
1. **Psychological Lead Capture**: Stops the scroll and captures the email via curiosity and value positioning.
2. **Email Campaign Engine**: Orchestrates 5-email sequences designed to move prospects through stages.
3. **High-Conversion Email Generation**: Writes the actual emails using the Sales Intelligence and Relationship Brains.

## Execution Scripts

| Script | Purpose |
|--------|---------|
| `execution/email_types.ts` | Zod schemas for prospects, campaigns, and hooks |
| `execution/email_engine.ts` | Dual-brain email writer + pattern distortion engine |
| `execution/lead_capture.ts` | Psychological hook and curiosity expansion generator |
| `execution/email_campaign.ts` | Sequence orchestration and prospect stage tracking |
| `execution/email_dev.ts` | Local CLI for testing email and hook generation |

## The 5-Email Sequence Strategy

1. **Email 1: Curiosity Trigger** — Focus on observation + curiosity. No pitch.
2. **Email 2: Insight Expansion** — Deepen interest by explaining the problem clearly.
3. **Email 3: Strategic Perspective** — Position authority with a useful industry insight.
4. **Email 4: Direct Offer** — Assertive push toward a walkthrough or demo.
5. **Email 5: Final Close** — Create psychological closure to trigger delayed replies.

## Lead Capture Architecture

*   **Layer 1: Psychological Hook**: Challenge an assumption (e.g., "Why most companies lose leads...").
*   **Layer 2: Curiosity Expansion**: Provide a partial explanation that creates mental agreement.
*   **Layer 3: Capture Moment**: Position the email field as a way to "continue learning".

## Integration with Conversation AI

When a prospect replies to an email or shows high engagement (multiple clicks/opens), the system should:
1. Transition the prospect profile into a client profile in `memory_store.ts`.
2. Handoff the conversation to `conversation_handler.ts` for real-time relationship building.

## Environment Requirements
*   `ANTHROPIC_API_KEY` is required for both strategic analysis and email writing.
*   `MEMORY_SPREADSHEET_ID` must have a "Prospects" and "EmailLog" tab for production use.
