/**
 * Client Memory Store
 *
 * Handles persistent client profile storage using Google Sheets.
 * Each client gets one row in the "Profiles" sheet.
 * Conversation logs go to a separate "Conversations" sheet.
 */

import { google, sheets_v4 } from "googleapis";
import { ClientProfile, ConversationMessage } from "./types.js";

// ─── Configuration ───────────────────────────────────────────

const SPREADSHEET_ID = process.env.MEMORY_SPREADSHEET_ID || "";
const PROFILES_SHEET = "Profiles";
const CONVERSATIONS_SHEET = "Conversations";

// Column layout for Profiles sheet
const PROFILE_COLUMNS = [
  "clientId",
  "name",
  "age",
  "profession",
  "goals",
  "challenges",
  "interests",
  "financialConcerns",
  "healthConcerns",
  "familyReferences",
  "lifeEvents",
  "preferredTone",
  "previousQuestions",
  "timelineEvents",
  "intentHistory",
  "lastContactDate",
  "conversationCount",
  "notes",
] as const;

// ─── Auth ────────────────────────────────────────────────────

function getSheets(): sheets_v4.Sheets {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// ─── Helpers ─────────────────────────────────────────────────

function serializeArray(arr: unknown[]): string {
  return JSON.stringify(arr);
}

function deserializeArray(val: string | undefined): string[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function deserializeJsonArray(val: string | undefined): unknown[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function rowToProfile(row: string[]): ClientProfile {
  return {
    clientId: row[0] || "",
    name: row[1] || undefined,
    age: row[2] || undefined,
    profession: row[3] || undefined,
    goals: deserializeArray(row[4]),
    challenges: deserializeArray(row[5]),
    interests: deserializeArray(row[6]),
    financialConcerns: deserializeArray(row[7]),
    healthConcerns: deserializeArray(row[8]),
    familyReferences: deserializeArray(row[9]),
    lifeEvents: deserializeArray(row[10]),
    preferredTone: row[11] || "friendly",
    previousQuestions: deserializeArray(row[12]),
    timelineEvents: deserializeJsonArray(row[13]) as ClientProfile["timelineEvents"],
    intentHistory: deserializeJsonArray(row[14]) as ClientProfile["intentHistory"],
    lastContactDate: row[15] || undefined,
    conversationCount: parseInt(row[16] || "0", 10),
    notes: row[17] || "",
  };
}

function profileToRow(profile: ClientProfile): string[] {
  return [
    profile.clientId,
    profile.name || "",
    profile.age || "",
    profile.profession || "",
    serializeArray(profile.goals),
    serializeArray(profile.challenges),
    serializeArray(profile.interests),
    serializeArray(profile.financialConcerns),
    serializeArray(profile.healthConcerns),
    serializeArray(profile.familyReferences),
    serializeArray(profile.lifeEvents),
    profile.preferredTone,
    serializeArray(profile.previousQuestions),
    serializeArray(profile.timelineEvents),
    serializeArray(profile.intentHistory),
    profile.lastContactDate || "",
    String(profile.conversationCount),
    profile.notes,
  ];
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Load a client profile by ID. Returns null if not found.
 */
export async function loadClientProfile(
  clientId: string
): Promise<ClientProfile | null> {
  const sheets = getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PROFILES_SHEET}!A:R`,
  });

  const rows = res.data.values || [];
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === clientId) {
      return rowToProfile(rows[i]);
    }
  }

  return null;
}

/**
 * Save a client profile. Creates or updates.
 */
export async function saveClientProfile(
  profile: ClientProfile
): Promise<void> {
  const sheets = getSheets();

  // Check if profile exists
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PROFILES_SHEET}!A:A`,
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === profile.clientId) {
      rowIndex = i + 1; // 1-indexed for Sheets API
      break;
    }
  }

  const rowData = profileToRow(profile);

  if (rowIndex > 0) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROFILES_SHEET}!A${rowIndex}:R${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowData] },
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROFILES_SHEET}!A:R`,
      valueInputOption: "RAW",
      requestBody: { values: [rowData] },
    });
  }
}

/**
 * Create a blank profile for a new client.
 */
export function createBlankProfile(clientId: string): ClientProfile {
  return {
    clientId,
    goals: [],
    challenges: [],
    interests: [],
    financialConcerns: [],
    healthConcerns: [],
    familyReferences: [],
    lifeEvents: [],
    preferredTone: "friendly",
    previousQuestions: [],
    timelineEvents: [],
    intentHistory: [],
    conversationCount: 0,
    notes: "",
  };
}

/**
 * Log a conversation message to the Conversations sheet.
 */
export async function logConversationMessage(
  clientId: string,
  message: ConversationMessage
): Promise<void> {
  const sheets = getSheets();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CONVERSATIONS_SHEET}!A:D`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [clientId, message.role, message.content, message.timestamp],
      ],
    },
  });
}

/**
 * Load recent conversation history for a client.
 */
export async function loadConversationHistory(
  clientId: string,
  limit: number = 20
): Promise<ConversationMessage[]> {
  const sheets = getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CONVERSATIONS_SHEET}!A:D`,
  });

  const rows = res.data.values || [];
  const clientMessages: ConversationMessage[] = [];

  // Skip header row, collect messages for this client
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === clientId) {
      clientMessages.push({
        role: rows[i][1] as "user" | "assistant",
        content: rows[i][2] || "",
        timestamp: rows[i][3] || "",
      });
    }
  }

  // Return most recent messages up to limit
  return clientMessages.slice(-limit);
}

/**
 * Initialize the spreadsheet with headers if they don't exist.
 */
export async function initializeSpreadsheet(): Promise<void> {
  const sheets = getSheets();

  // Check if Profiles sheet has headers
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROFILES_SHEET}!A1:R1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PROFILES_SHEET}!A1:R1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [PROFILE_COLUMNS as unknown as string[]],
        },
      });
    }
  } catch {
    // Sheet might not exist — that's an env setup issue
    console.error(
      "Could not access Profiles sheet. Ensure the spreadsheet exists and has a 'Profiles' tab."
    );
  }

  // Check Conversations sheet
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONVERSATIONS_SHEET}!A1:D1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${CONVERSATIONS_SHEET}!A1:D1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["clientId", "role", "content", "timestamp"]],
        },
      });
    }
  } catch {
    console.error(
      "Could not access Conversations sheet. Ensure the spreadsheet has a 'Conversations' tab."
    );
  }
}
