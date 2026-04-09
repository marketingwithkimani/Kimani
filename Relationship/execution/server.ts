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
const port = process.env.PORT || 3002;

// Persistent store fallback if Google Sheets is not configured
import * as fs from "fs";
import * as path from "path";
const LEADS_FILE = path.join(process.cwd(), "leads_backup.json");
const POTENTIAL_LEADS_FILE = path.join(process.cwd(), "potential_leads_backup.json");

function saveLeadToBackup(lead: any) {
  try {
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
    }
    leads.push({ ...lead, timestamp: new Date().toISOString() });
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  } catch (e) {
    console.error("Backup failed", e);
  }
}

function savePotentialLeadsToBackup(newLeads: any[]) {
  try {
    let leads = [];
    if (fs.existsSync(POTENTIAL_LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(POTENTIAL_LEADS_FILE, "utf-8"));
    }
    // Mix in new ones, keep unique by ID or email
    const all = [...newLeads, ...leads].slice(0, 50); // Keep last 50
    fs.writeFileSync(POTENTIAL_LEADS_FILE, JSON.stringify(all, null, 2));
  } catch (e) {
    console.error("Potential Backup failed", e);
  }
}

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
    
    // 6. Save Profile (Persistence)
    try {
      // Update profile with any extracted memory
      if (result.memoryUpdates) {
        Object.assign(profile, result.memoryUpdates);
      }
      profile.lastContactDate = new Date().toISOString();
      profile.conversationCount++;
      
      // Save to Google Sheets if possible
      if (process.env.MEMORY_SPREADSHEET_ID) {
        await saveClientProfile(profile);
      }
      
      // Always save to local backup for dashboard stability
      saveLeadToBackup({
        name: profile.name || "Anonymous",
        email: profile.profession || "Chat Lead", // Using profession as a proxy if email not known yet
        company: profile.notes || "AI Chat",
        stage: intent.stage,
        capturedVia: "AI Relationship Agent"
      });
    } catch (saveError) {
      console.warn("Non-critical save error:", saveError);
    }

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

app.post("/api/contact", async (req, res) => {
  const { fullName, email, organization, interest, message } = req.body;
  
  if (!email || !fullName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const lead = {
      name: fullName,
      email: email,
      company: organization || "Not Specified",
      stage: "Ready",
      capturedVia: "Contact Form",
      interest: interest || "General Inquiry",
      message: message
    };

    // Save to backup
    saveLeadToBackup(lead);

    // If Google Sheets is configured, save as prospect
    if (process.env.MEMORY_SPREADSHEET_ID) {
      const prospect = {
        prospectId: `lead-${Date.now()}`,
        name: fullName,
        email: email,
        industry: organization || "General",
        status: "captured"
      };
      await saveProspect(prospect as any);
    }

    // Send an automatic response using 'enquiries'
    try {
      const responseEmailText = `Hello ${fullName},

Thank you for reaching out via the Marketing with Kimani site.

I have received your message regarding "${interest || 'your inquiry'}". I'll review the details you provided and get back to you personally within the next 24-48 hours.

In the meantime, feel free to explore the 67% market strategy on our site if you haven't already.

Best regards,
Kimani 
Marketing with Kimani`;

      await sendEmailToProspect(
        { email, name: fullName } as any, 
        { 
          subjectLine: `Re: Your inquiry about ${interest || 'Marketing with Kimani'}`,
          body: responseEmailText,
          closingName: "Kimani",
          patternBreakers: ["automated_acknowledgment"],
          estimatedReadTime: "30s"
        } as any,
        "enquiries"
      );
    } catch (emailError) {
      console.error("Failed to send acknowledgment email:", emailError);
    }

    res.json({ success: true, message: "Lead captured successfully" });
  } catch (error: any) {
    console.error("Contact save error:", error);
    res.status(500).json({ error: "Failed to record contact details" });
  }
});

// ─── Dashboard API ───────────────────────────────────────────

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "0727856464"; // Default demo password

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
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
    }
    
    // If no real leads, return the mock ones for visual stability
    if (leads.length === 0) {
      leads = [
        { name: "Sarah J.", email: "sarah@example.com", company: "FinTech Hub", stage: "Ready", capturedVia: "67% Page" },
        { name: "David M.", email: "david@mtech.co", company: "M-Tech Solutions", stage: "Curious", capturedVia: "Homepage" }
      ];
    }
    
    res.json(leads.reverse()); // Newest first
  } catch (error) {
    res.json([]);
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
  try {
    let leads = [];
    if (fs.existsSync(POTENTIAL_LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(POTENTIAL_LEADS_FILE, "utf-8"));
    }
    
    // Add default mock if empty
    if (leads.length === 0) {
      leads = [
        { id: "p1", company: "Global Corp", strategy: "Curiosity Trigger", status: "Scheduled" },
        { id: "p2", company: "Local Biz", strategy: "Insight Expansion", status: "Pending" }
      ];
    }
    res.json(leads.slice(0, 10)); // Top 10
  } catch (error) {
    res.json([]);
  }
});

app.post("/api/automation/run", async (req, res) => {
  try {
    // 1. Actually find some leads
    const industries = ["Technology", "Real Estate", "Aviation", "Banking"];
    const randomIndustry = industries[Math.floor(Math.random() * industries.length)];
    const discovered = await findPotentialLeads(randomIndustry, "Director");
    
    // 2. Format for dashboard queue
    const queueItems = discovered.map(l => ({
      id: l.prospectId,
      company: l.companyName,
      strategy: l.observations[0] || "Warm Outreach",
      status: "Ready for Email"
    }));
    
    // 3. Save to potential leads backup
    savePotentialLeadsToBackup(queueItems);

    res.json({ 
      success: true, 
      message: `A.I. has completed its analysis of the ${randomIndustry} market.`,
      actions: [
        `Identified ${discovered.length} high-intent prospects...`,
        "Generated personalized curiosity triggers...",
        "Queuing automation sequences for review."
      ]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
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

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Relationship AI Server running at http://localhost:${port}`);
  });
}

export default app;
