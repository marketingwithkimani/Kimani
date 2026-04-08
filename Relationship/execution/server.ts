/**
 * Relationship AI Server
 *
 * Exposes the Relationship Brain via a REST API for the frontend demo.
 */

import express from "express";
import cors from "cors";
import { analyzeIntent } from "./intent_analyzer.js";
import { calculateMomentum } from "./momentum_engine.js";
import { generateVariabilityDirective } from "./variability_engine.js";
import { generateResponse } from "./ai_engine.js";
import { loadProspect, saveProspect, initializeEmailSheets } from "./email_campaign.js";
import { loadClientProfile, saveClientProfile, initializeSpreadsheet } from "./memory_store.js";
import { findPotentialLeads } from "./lead_finder.js";
import { sendEmailToProspect } from "./delivery_engine.js";
import { generateEmail } from "./email_engine.js";
import { ClientProfile, ConversationMessage } from "./types.js";
import { google } from "googleapis";
import "dotenv/config";

const app = express();
const port = 3002;

app.use(cors({ origin: "*" }));
app.use(express.json());

// In-memory sessions (for demo purposes)
const sessions = new Map<string, {
  profile: ClientProfile;
  history: ConversationMessage[];
}>();

function getOrCreateSession(sessionId: string) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      profile: {
        clientId: sessionId,
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
      },
      history: [],
    });
  }
  return sessions.get(sessionId)!;
}

app.post("/api/chat", async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "Missing sessionId or message" });
  }

  try {
    const session = getOrCreateSession(sessionId);
    const { profile, history } = session;

    // 1. Analyze Intent
    const intent = await analyzeIntent(message, history, profile);

    // 2. Momentum
    const momentum = calculateMomentum(message, history, intent);

    // 3. Variability
    const variability = generateVariabilityDirective(intent, history);

    // 4. Generate Response
    const result = await generateResponse(
      message,
      history,
      profile,
      intent,
      variability,
      momentum
    );

    // 5. Update Session
    const userMsg: ConversationMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: ConversationMessage = {
      role: "assistant",
      content: result.response,
      timestamp: new Date().toISOString(),
    };

    history.push(userMsg, assistantMsg);
    
    // Limits history to last 20 messages
    if (history.length > 20) {
      session.history = history.slice(-20);
    }

    res.json({
      response: result.response,
      intent: {
        score: intent.intentScore,
        stage: intent.stage,
        emotion: intent.emotion
      }
    });

  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ─── Dashboard API ───────────────────────────────────────────

const DASHBOARD_PASSWORD = "kimani_dashboard_2024"; // Simple demo password

app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === DASHBOARD_PASSWORD) {
    res.json({ success: true, token: "demo-token" });
  } else {
    res.status(401).json({ success: false, error: "Incorrect password" });
  }
});

app.get("/api/dashboard/stats", async (req, res) => {
  // Mock stats for demo
  res.json({
    totalLeads: 124,
    emailsSent: 842,
    conversionRate: "18.5%",
    activeCampaigns: 3
  });
});

app.get("/api/dashboard/leads", async (req, res) => {
  try {
    const SPREADSHEET_ID = process.env.MEMORY_SPREADSHEET_ID;
    if (!SPREADSHEET_ID) throw new Error("No spreadsheet ID");
    
    // In a real app, we'd fetch from PROSPECTS_SHEET
    // For the demo, we'll return some curated mock data + real data if possible
    const mockLeads = [
      { id: "1", name: "Sarah J.", email: "sarah@example.com", company: "FinTech Hub", stage: "Ready", capturedVia: "67% Page" },
      { id: "2", name: "David M.", email: "david@mtech.co", company: "M-Tech Solutions", stage: "Curious", capturedVia: "Homepage" },
      { id: "3", name: "Anita O.", email: "anita@nexus.ke", company: "Nexus Logistics", stage: "Interested", capturedVia: "Strategy Page" }
    ];
    res.json(mockLeads);
  } catch (error) {
    res.json([
      { id: "1", name: "Sarah J.", email: "sarah@example.com", company: "FinTech Hub", stage: "Ready", capturedVia: "67% Page" },
      { id: "2", name: "David M.", email: "david@mtech.co", company: "M-Tech Solutions", stage: "Curious", capturedVia: "Homepage" }
    ]);
  }
});

app.get("/api/dashboard/contacts", async (req, res) => {
  // Returns people in the Profiles sheet
  res.json([
    { id: "c1", name: "Sarah J.", lastContact: "2 hours ago", status: "Active" },
    { id: "c2", name: "David M.", lastContact: "5 hours ago", status: "Idle" }
  ]);
});

app.get("/api/dashboard/potential-leads", async (req, res) => {
  // Returns people waiting for automation
  res.json([
    { id: "p1", email: "ceo@globalcorp.com", company: "Global Corp", strategy: "Curiosity Trigger", status: "Scheduled" },
    { id: "p2", email: "info@localbiz.ke", company: "Local Biz", strategy: "Insight Expansion", status: "Pending" }
  ]);
});

app.post("/api/automation/run", async (req, res) => {
  // Simulate AI running a lead gen or email sequence
  console.log("AI Automation triggered via Dashboard");
  res.json({ 
    success: true, 
    message: "A.I. is now analyzing the 67% market and preparing automated sequences.",
    actions: [
      "Analyzing latest conversation sentiment...",
      "Generating curiosity triggers for 12 prospects...",
      "Updating relationship momentum scores..."
    ]
  });
});

app.post("/api/leads/find", async (req, res) => {
  const { industry, targetRole } = req.body;
  if (!industry) return res.status(400).json({ error: "Missing industry" });
  
  try {
    const leads = await findPotentialLeads(industry, targetRole || "Director");
    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/leads/send-email", async (req, res) => {
  const { prospectId, industry } = req.body;
  
  try {
    // 1. Generate the email
    // This uses the existing email_engine logic
    const mockProspect = { 
      prospectId: prospectId || "demo-prospect", 
      email: "test@example.com",
      name: "Prospect",
      industry: industry || "Technology"
    };

    // Simulate generation and sending
    const result = await generateEmail({
      prospect: mockProspect as any,
      campaignPosition: "curiosity_trigger",
      productOrService: "Relationship AI",
      valueProposition: "Converting the 67% of the market that's observing but not buying.",
      companyName: "Marketing with Kimani",
      senderName: "Kimani",
      senderRole: "Lead Strategist"
    });

    const sent = await sendEmailToProspect(mockProspect as any, result.email);
    
    res.json({ success: sent, email: result.email });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Relationship AI Server running at http://localhost:${port}`);
  
  // Heartbeat to keep the process alive in certain environments
  setInterval(() => {
    // console.log("Heartbeat...");
  }, 60000);
});
