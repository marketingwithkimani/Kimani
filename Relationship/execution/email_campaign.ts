/**
 * Email Campaign Manager
 *
 * Manages the full lifecycle of email campaigns:
 * - Campaign creation with prospect profiles
 * - Sequential email generation (5-email sequences)
 * - Prospect stage tracking
 * - Campaign storage via Google Sheets
 * - Integration with Trigger.dev for scheduled sends
 *
 * Pipeline:
 *   Lead Capture → Campaign Manager → Email Engine → Delivery
 */

import { google, sheets_v4 } from "googleapis";
import {
  ProspectProfile,
  EmailCampaign,
  EmailEngineInput,
  EmailEngineOutput,
  CampaignPosition,
  GeneratedEmail,
} from "./email_types.js";
import { generateEmail, generateFullCampaign } from "./email_engine.js";

// ─── Configuration ───────────────────────────────────────────

const SPREADSHEET_ID = process.env.MEMORY_SPREADSHEET_ID || "";
const PROSPECTS_SHEET = "Prospects";
const CAMPAIGNS_SHEET = "Campaigns";
const EMAIL_LOG_SHEET = "EmailLog";

// ─── Google Sheets Auth ──────────────────────────────────────

function getSheets(): sheets_v4.Sheets {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// ─── Prospect Management ─────────────────────────────────────

/**
 * Load a prospect profile from the Prospects sheet.
 */
export async function loadProspect(
  prospectId: string
): Promise<ProspectProfile | null> {
  const sheets = getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PROSPECTS_SHEET}!A:T`,
  });

  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === prospectId) {
      return rowToProspect(rows[i]);
    }
  }
  return null;
}

/**
 * Save a prospect profile. Creates or updates.
 */
export async function saveProspect(prospect: ProspectProfile): Promise<void> {
  const sheets = getSheets();
  const row = prospectToRow(prospect);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PROSPECTS_SHEET}!A:A`,
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === prospect.prospectId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROSPECTS_SHEET}!A${rowIndex}:T${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROSPECTS_SHEET}!A:T`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  }
}

/**
 * Log a sent email for tracking.
 */
export async function logSentEmail(
  prospectId: string,
  email: GeneratedEmail,
  campaignId: string
): Promise<void> {
  const sheets = getSheets();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EMAIL_LOG_SHEET}!A:F`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          prospectId,
          campaignId,
          email.strategy.campaignPosition,
          email.subjectLine,
          email.body.substring(0, 500),
          new Date().toISOString(),
        ],
      ],
    },
  });
}

// ─── Campaign Orchestration ──────────────────────────────────

/**
 * Create a new campaign and generate all 5 emails.
 */
export async function createCampaign(config: {
  campaignName: string;
  productOrService: string;
  targetAudience: string;
  valueProposition: string;
  companyName: string;
  senderName: string;
  senderRole: string;
  prospects: ProspectProfile[];
}): Promise<{
  campaign: EmailCampaign;
  prospectEmails: Map<string, EmailEngineOutput[]>;
}> {
  const campaignId = `campaign-${Date.now()}`;
  const timestamp = new Date().toISOString();

  console.log(`\n═══ Creating campaign: ${config.campaignName} ═══`);
  console.log(`Prospects: ${config.prospects.length}`);

  const prospectEmails = new Map<string, EmailEngineOutput[]>();
  const allEmails: GeneratedEmail[] = [];

  for (const prospect of config.prospects) {
    console.log(`\nGenerating sequence for ${prospect.name || prospect.email}...`);

    const results = await generateFullCampaign({
      prospect: { ...prospect, campaignId },
      productOrService: config.productOrService,
      valueProposition: config.valueProposition,
      companyName: config.companyName,
      senderName: config.senderName,
      senderRole: config.senderRole,
    });

    prospectEmails.set(prospect.prospectId, results);

    for (const result of results) {
      allEmails.push(result.email);
    }
  }

  const campaign: EmailCampaign = {
    campaignId,
    name: config.campaignName,
    productOrService: config.productOrService,
    targetAudience: config.targetAudience,
    valueProposition: config.valueProposition,
    companyName: config.companyName,
    senderName: config.senderName,
    senderRole: config.senderRole,
    emails: allEmails,
    createdAt: timestamp,
    status: "draft",
  };

  console.log(`\n═══ Campaign created: ${allEmails.length} emails generated ═══\n`);

  return { campaign, prospectEmails };
}

/**
 * Send the next email in a prospect's sequence.
 * Returns the email to send and updates the prospect's stage.
 */
export async function sendNextInSequence(
  prospect: ProspectProfile,
  campaignConfig: {
    productOrService: string;
    valueProposition: string;
    companyName: string;
    senderName: string;
    senderRole: string;
  }
): Promise<EmailEngineOutput | null> {
  // Determine next position in sequence
  const sequence: CampaignPosition[] = [
    "curiosity_trigger",
    "insight_expansion",
    "strategic_perspective",
    "direct_offer",
    "final_close",
  ];

  let nextPosition: CampaignPosition;

  if (!prospect.currentCampaignPosition) {
    nextPosition = "curiosity_trigger";
  } else {
    const currentIndex = sequence.indexOf(prospect.currentCampaignPosition);
    if (currentIndex >= sequence.length - 1) {
      console.log("Campaign sequence complete for this prospect.");
      return null;
    }
    nextPosition = sequence[currentIndex + 1];
  }

  // Check if prospect has replied — if so, transition to conversation AI
  if (prospect.emailsReplied > 0) {
    console.log("Prospect has replied — transitioning to conversation AI.");
    return null;
  }

  const result = await generateEmail({
    prospect,
    campaignPosition: nextPosition,
    ...campaignConfig,
  });

  return result;
}

// ─── Prospect Stage Logic ────────────────────────────────────

/**
 * Update prospect stage based on engagement signals.
 */
export function updateProspectStage(prospect: ProspectProfile): ProspectProfile {
  const updated = { ...prospect };

  if (prospect.emailsReplied > 0) {
    updated.stage = "interested";
  } else if (prospect.emailsClicked > 0) {
    updated.stage = "curious";
  } else if (prospect.emailsOpened > 0 && prospect.emailsSent >= 2) {
    updated.stage = "curious";
  } else if (prospect.emailsSent >= 5 && prospect.emailsOpened === 0) {
    updated.stage = "dormant";
  }

  return updated;
}

/**
 * Check if a prospect should transition from email to conversation AI.
 */
export function shouldTransitionToConversation(
  prospect: ProspectProfile
): boolean {
  return (
    prospect.emailsReplied > 0 ||
    (prospect.emailsClicked >= 2 && prospect.emailsOpened >= 3) ||
    prospect.stage === "ready"
  );
}

// ─── Serialization Helpers ───────────────────────────────────

function prospectToRow(p: ProspectProfile): string[] {
  return [
    p.prospectId,
    p.email,
    p.name || "",
    p.companyName || "",
    p.companyUrl || "",
    p.industry || "",
    p.role || "",
    p.stage,
    JSON.stringify(p.observations),
    JSON.stringify(p.painPoints),
    p.notes,
    p.campaignId || "",
    p.currentCampaignPosition || "",
    String(p.emailsSent),
    String(p.emailsOpened),
    String(p.emailsClicked),
    String(p.emailsReplied),
    p.lastEmailDate || "",
    p.firstContactDate || "",
    p.capturedVia || "",
  ];
}

function rowToProspect(row: string[]): ProspectProfile {
  return {
    prospectId: row[0] || "",
    email: row[1] || "",
    name: row[2] || undefined,
    companyName: row[3] || undefined,
    companyUrl: row[4] || undefined,
    industry: row[5] || undefined,
    role: row[6] || undefined,
    stage: (row[7] as ProspectProfile["stage"]) || "cold",
    observations: safeJsonParse(row[8], []),
    painPoints: safeJsonParse(row[9], []),
    notes: row[10] || "",
    campaignId: row[11] || undefined,
    currentCampaignPosition: (row[12] as ProspectProfile["currentCampaignPosition"]) || undefined,
    emailsSent: parseInt(row[13] || "0", 10),
    emailsOpened: parseInt(row[14] || "0", 10),
    emailsClicked: parseInt(row[15] || "0", 10),
    emailsReplied: parseInt(row[16] || "0", 10),
    lastEmailDate: row[17] || undefined,
    firstContactDate: row[18] || undefined,
    capturedVia: row[19] || undefined,
    tags: [],
  };
}

function safeJsonParse<T>(val: string | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// ─── Sheet Initialization ────────────────────────────────────

/**
 * Initialize email-related sheets with headers.
 */
export async function initializeEmailSheets(): Promise<void> {
  const sheets = getSheets();

  const sheetConfigs = [
    {
      name: PROSPECTS_SHEET,
      range: `${PROSPECTS_SHEET}!A1:T1`,
      headers: [
        "prospectId", "email", "name", "companyName", "companyUrl",
        "industry", "role", "stage", "observations", "painPoints",
        "notes", "campaignId", "currentPosition", "emailsSent",
        "emailsOpened", "emailsClicked", "emailsReplied",
        "lastEmailDate", "firstContactDate", "capturedVia",
      ],
    },
    {
      name: EMAIL_LOG_SHEET,
      range: `${EMAIL_LOG_SHEET}!A1:F1`,
      headers: [
        "prospectId", "campaignId", "position",
        "subjectLine", "bodyPreview", "sentAt",
      ],
    },
  ];

  for (const config of sheetConfigs) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: config.range,
      });

      if (!res.data.values || res.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: config.range,
          valueInputOption: "RAW",
          requestBody: { values: [config.headers] },
        });
        console.log(`Initialized ${config.name} sheet headers.`);
      }
    } catch {
      console.error(`Could not access ${config.name} sheet.`);
    }
  }
}
