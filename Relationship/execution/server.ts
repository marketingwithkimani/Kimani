/**
 * Relationship AI Server
 *
 * Exposes the Relationship Brain via a REST API for the frontend demo.
 */
console.log(">>> AI SERVER SCRIPT STARTING <<<");

import express from "express";
import cors from "cors";
import { analyzeIntent } from "./intent_analyzer.js";
import { calculateMomentum } from "./momentum_engine.js";
import { generateVariabilityDirective } from "./variability_engine.js";
import { generateResponse } from "./ai_engine.js";
import { loadProspect, saveProspect, initializeEmailSheets } from "./email_campaign.js";
import { loadClientProfile, saveClientProfile, initializeSpreadsheet } from "./memory_store.js";
import { 
  loadClientProfile as loadClientProfileSupabase, 
  saveClientProfile as saveClientProfileSupabase, 
  logConversationMessage as logConversationMessageSupabase,
  loadConversationHistory as loadConversationHistorySupabase,
  saveLead as saveLeadSupabase,
  loadLeadsFromSupabase
} from "./supabase_memory.js";
import { findPotentialLeads } from "./lead_finder.js";
import { sendEmailToProspect } from "./delivery_engine.js";
import { generateEmail } from "./email_engine.js";
import { ClientProfile, ConversationMessage } from "./types.js";
import { google } from "googleapis";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { resolve as resolvePath } from "path";

// Explicitly resolve .env — works regardless of which directory npm start is run from
const envPath1 = resolvePath(process.cwd(), ".env");
const envPath2 = resolvePath(process.cwd(), "..", ".env");
const loadedEnv = dotenv.config({ path: envPath1 });
if (loadedEnv.error) {
  dotenv.config({ path: envPath2 });
}

// Startup diagnostic — shows whether the API key is loaded and what type it is
const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || "";
if (!apiKey) {
  console.error("❌ CRITICAL: No API key found. Set ANTHROPIC_API_KEY in your .env file.");
} else if (apiKey.startsWith("sk-or-v1")) {
  console.log("✅ API Key Type: OpenRouter (sk-or-v1-...)");
  console.log("   → Routing via https://openrouter.ai/api");
} else if (apiKey.startsWith("sk-ant")) {
  console.log("✅ API Key Type: Anthropic (sk-ant-...)");
} else {
  console.warn("⚠️  API Key found but type is unrecognised. Check your .env ANTHROPIC_API_KEY value.");
}

// Supabase diagnostic
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ CRITICAL: Supabase credentials missing. Relationship Engine will be unstable.");
} else {
  console.log("✅ Supabase Connected:", process.env.SUPABASE_URL);
}

const app = express();
const port = process.env.PORT || 3010;

// Persistent store fallback if Google Sheets is not configured
const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const LEADS_FILE = isVercel ? path.join("/tmp", "leads_backup.json") : path.join(process.cwd(), "leads_backup.json");
const POTENTIAL_LEADS_FILE = isVercel ? path.join("/tmp", "potential_leads_backup.json") : path.join(process.cwd(), "potential_leads_backup.json");
const LOG_FILE = isVercel ? path.join("/tmp", "debug.log") : path.join(process.cwd(), "debug.log");

function logToFile(message: string) {
  const logMsg = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync(LOG_FILE, logMsg);
  } catch (e) {
    // Ignore log failures in production if /tmp is full or inaccessible
  }
}


function saveLeadToBackup(lead: any) {
  try {
    let leads: any[] = [];
    if (fs.existsSync(LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
    }
    
    // Group by Session ID to capture the "Whole Conversation"
    const existingIndex = leads.findIndex(l => l.sessionId === lead.sessionId);
    
    if (existingIndex !== -1) {
      // Update existing lead with latest interaction data
      leads[existingIndex] = {
        ...leads[existingIndex],
        ...lead,
        // Append conversation history if provided
        fullConversation: lead.fullConversation || leads[existingIndex].fullConversation,
        timestamp: new Date().toISOString()
      };
    } else {
      // Create new lead entry
      leads.push({ ...lead, timestamp: new Date().toISOString() });
    }
    
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

// No more in-memory sessions! We fetch from Supabase or Local Backup on every request 
// to ensure the brain never 'forgets' in a serverless environment.

async function getOrCreateSession(sessionId: string) {
  // 1. Try loading from Supabase first
  let profile: ClientProfile | null = null;
  let history: ConversationMessage[] = [];

  try {
    if (process.env.SUPABASE_URL) {
      profile = await loadClientProfileSupabase(sessionId);
      if (profile) {
        history = await loadConversationHistorySupabase(sessionId);
      }
    }
  } catch (err) {
    console.warn("Supabase session load error:", err);
  }

  // 2. If not in Supabase, try loading from local backup (for dashboard stability)
  if (!profile) {
    try {
      const LEADS_FILE = process.env.VERCEL === "1" ? "/tmp/leads_backup.json" : "leads_backup.json";
      if (fs.existsSync(LEADS_FILE)) {
        const leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
        const lead = leads.find((l: any) => l.sessionId === sessionId);
        if (lead) {
          // Reconstruct profile/history from backup
          profile = {
            clientId: sessionId,
            name: lead.name,
            profession: lead.profession,
            notes: lead.company,
            goals: [], challenges: [], interests: [], financialConcerns: [], healthConcerns: [], 
            familyReferences: [], lifeEvents: [], preferredTone: "friendly", 
            previousQuestions: [], timelineEvents: [], intentHistory: [], conversationCount: 1
          };
          history = lead.fullConversation || [];
        }
      }
    } catch (e) {
      console.warn("Local backup load error:", e);
    }
  }

  // 3. Fallback to a brand new profile
  if (!profile) {
    profile = {
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
    };
  }

  return { profile, history };
}

app.get("/ping", (req, res) => res.send("pong"));

app.post("/kimani-ai-core/chat", async (req, res) => {
  logToFile(`HIT /api/rel-chat`);

  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "Missing sessionId or message" });
  }

  try {
    const session = await getOrCreateSession(sessionId);
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

    // 5. Process Bursts
    const rawResponse = result.response;
    const bursts = rawResponse.split("[BURST]").map(b => b.trim()).filter(b => b.length > 0);
    const cleanResponse = bursts.join(" ");

    // 6. Update Session
    const userMsg: ConversationMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: ConversationMessage = {
      role: "assistant",
      content: cleanResponse, // Store clean text in history for better AI reasoning
      timestamp: new Date().toISOString(),
    };

    history.push(userMsg, assistantMsg);
    
    // 7. Save Profile (Persistence) & Interaction Tracking
    try {
      // Update profile with any extracted memory
      if (result.memoryUpdates) {
        Object.assign(profile, result.memoryUpdates);
      }
      profile.lastContactDate = new Date().toISOString();
      profile.conversationCount++;
      profile.messageCount = (profile.messageCount || 0) + 1;
      
      // Auto-increment disclosure level every 3 messages
      if (profile.messageCount % 3 === 0) {
        profile.disclosureLevel = (profile.disclosureLevel || 0) + 1;
      }
      
      // Save to Google Sheets if possible
      if (process.env.MEMORY_SPREADSHEET_ID) {
        await saveClientProfile(profile);
      }
      
      // Save to Supabase
      if (process.env.SUPABASE_URL) {
        await saveClientProfileSupabase(profile);
        await logConversationMessageSupabase(sessionId, userMsg);
        await logConversationMessageSupabase(sessionId, assistantMsg);
        
        await saveLeadSupabase({
          sessionId,
          name: profile.name || "Anonymous",
          profession: profile.profession || "Chat Lead",
          country: profile.country || "Not specified",
          company: profile.notes || "AI Chat",
          stage: intent.stage,
          intentScore: intent.intentScore,
          discoverySummary: result.discoverySummary || "Establishing rapport...",
          suggestedNextAction: result.suggestedNextAction || "Continue discovery.",
          fullConversation: history,
          capturedVia: "AI Relationship Agent"
        });
      }
      
      // Always save to local backup for dashboard stability
      saveLeadToBackup({
        sessionId,
        name: profile.name || "Anonymous",
        profession: profile.profession || "Chat Lead",
        country: profile.country || "Not specified",
        company: profile.notes || "AI Chat",
        stage: intent.stage,
        intentScore: intent.intentScore,
        discoverySummary: result.discoverySummary || "Establishing rapport...",
        suggestedNextAction: result.suggestedNextAction || "Continue discovery.",
        fullConversation: history,
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
      response: cleanResponse,
      bursts,
      intent: {
        score: intent.intentScore,
        stage: intent.stage,
        emotion: intent.emotion
      }
    });

  } catch (error: any) {
    logToFile(`ERROR: ${error.message}\n${error.stack}`);
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

    // Save to Supabase
    if (process.env.SUPABASE_URL) {
      await saveLeadSupabase(lead);
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

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
if (!DASHBOARD_PASSWORD) {
  console.warn("⚠️  DASHBOARD_PASSWORD not set in .env. Dashboard login will not be possible.");
}

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
    
    // Try fetching from Supabase first
    if (process.env.SUPABASE_URL) {
      const { data, error } = await loadLeadsFromSupabase();
      if (!error && data) {
        leads = data;
      }
    }

    // Fallback to local file if Supabase is empty or failed
    if (leads.length === 0 && fs.existsSync(LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
    }
    
    // If no real leads anywhere, return the mock ones for visual stability
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
    // 1. Research high-growth African markets
    const industries = ["Technology", "Real Estate", "Aviation", "Banking", "AgriTech", "Renewable Energy"];
    const countries = ["Kenya", "Nigeria", "South Africa", "Ghana", "Rwanda", "Ethiopia", "Mauritius"];
    
    const randomIndustry = industries[Math.floor(Math.random() * industries.length)];
    const randomCountry = countries[Math.floor(Math.random() * countries.length)];
    const searchQuery = `${randomIndustry} in ${randomCountry}`;
    
    const discovered = await findPotentialLeads(searchQuery, "Founder or Director");
    
    // 2. Format for dashboard queue with deep insights
    const queueItems = discovered.map(l => ({
      id: l.prospectId,
      name: l.name,
      email: l.email,
      company: l.companyName,
      location: randomCountry,
      industry: randomIndustry,
      discovery: l.observations.join(", "),
      strategy: `AI Suggested: Reach out regarding ${l.painPoints[0] || "market expansion"} in ${randomCountry}.`,
      status: "Ready for Outreach"
    }));
    
    // 3. Save to potential leads backup
    savePotentialLeadsToBackup(queueItems);

    res.json({ 
      success: true, 
      message: `A.I. has completed its analysis of ${randomCountry}'s ${randomIndustry} market.`,
      actions: [
        `Identified ${discovered.length} strategic partners in ${randomCountry}...`,
        "Extracted market-specific pain points...",
        "Queuing personalized outreach sequences."
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
  app.listen(port, "0.0.0.0", () => {
    console.log(`Relationship AI Server running at http://localhost:${port}`);
  });
}

export default app;
