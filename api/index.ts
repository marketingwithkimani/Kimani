import { VercelRequest, VercelResponse } from '@vercel/node';
import cors from 'cors';
import { generateResponse } from "../Relationship/execution/ai_engine.js";
import { calculateMomentum } from "../Relationship/execution/momentum_engine.js";
import { generateVariabilityDirective } from "../Relationship/execution/variability_engine.js";
import { 
  loadClientProfile as loadClientProfileSupabase, 
  loadConversationHistory as loadConversationHistorySupabase,
  saveClientProfile as saveClientProfileSupabase,
  logConversationMessage as logConversationMessageSupabase,
  saveLead as saveLeadSupabase,
  loadLeadsFromSupabase
} from "../Relationship/execution/supabase_memory.js";
import { generateEmail } from "../Relationship/execution/email_engine.js";

// CORS middleware
const corsMiddleware = cors({ origin: '*' });

function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// Session loader (Stateless)
async function getSession(sessionId: string) {
  let profile = null;
  let history = [];

  try {
    if (process.env.SUPABASE_URL) {
      profile = await loadClientProfileSupabase(sessionId);
      if (profile) {
        history = await loadConversationHistorySupabase(sessionId);
      }
    }
  } catch (err) {
    console.warn("Supabase load error:", err);
  }

  if (!profile) {
    profile = { clientId: sessionId, goals: [], challenges: [], interests: [], financialConcerns: [], healthConcerns: [], familyReferences: [], lifeEvents: [], preferredTone: "friendly", previousQuestions: [], timelineEvents: [], intentHistory: [], conversationCount: 0, notes: "" };
  }

  return { profile, history };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await runMiddleware(req, res, corsMiddleware);

  const path = req.url || '';
  
  // ─── HEALTH CHECK ───
  if (path.includes('/api/health') || path === '/api') {
    return res.status(200).json({
      status: "online",
      env: {
        supabase: !!process.env.SUPABASE_URL,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        openrouter: !!process.env.OPENROUTER_API_KEY
      }
    });
  }

  // ─── LOGIN ───
  if (path.includes('/api/login')) {
    const { password } = req.body;
    if (password === process.env.DASHBOARD_PASSWORD) {
      return res.status(200).json({ success: true, token: "demo-token" });
    }
    return res.status(401).json({ error: "Incorrect password" });
  }

  // ─── DASHBOARD STATS ───
  if (path.includes('/api/dashboard/stats')) {
    return res.json({ totalLeads: 124, emailsSent: 842, conversionRate: "18.5%", activeCampaigns: 3 });
  }

  // ─── DASHBOARD LEADS ───
  if (path.includes('/api/dashboard/leads')) {
    try {
      const { data } = await loadLeadsFromSupabase();
      return res.json(data || []);
    } catch (e: any) {
      console.error("Dashboard leads error:", e);
      return res.json([]);
    }
  }

  // ─── POTENTIAL LEADS ───
  if (path.includes('/api/dashboard/potential-leads')) {
    // In a real setup, this would query a 'potential_leads' table
    // For now, returning a sample to make the UI look alive
    return res.json([
      { id: "p1", company: "Zuberi Financial", location: "Nairobi, KE", strategy: "Brand Positioning", industry: "FinTech", discovery: "Scaling rapidly but lacking consistent relationship nurture." },
      { id: "p2", company: "Lagos Logistics", location: "Lagos, NG", strategy: "Corporate Strategy", industry: "Logistics", discovery: "Heavy reliance on cold calls; needs 'insight-driven' trust builds." }
    ]);
  }

  // ─── SEND EMAIL ───
  if (path.includes('/api/leads/send-email')) {
    const { prospectId, industry } = req.body;
    try {
      const result = await generateEmail({
        prospect: { name: "Prospect", email: "client@example.com", companyName: "Target Co", observations: [industry], stage: "curiosity", emailsSent: 0 } as any,
        campaignPosition: "curiosity_trigger",
        valueProposition: "Relationship-Driven Growth",
        senderName: "Kimani",
        senderRole: "Lead Strategist",
        companyName: "Marketing with Kimani"
      });
      return res.json({ success: true, email: result.email });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─── CONTACT FORM ───
  if (path.includes('/api/contact')) {
    const { fullName, email, organization, interest, message } = req.body;
    try {
      if (process.env.SUPABASE_URL) {
        await saveLeadSupabase({
          name: fullName,
          email,
          company: organization || "Not Specified",
          stage: "Ready",
          capturedVia: "Contact Form",
          interest: interest || "General Inquiry",
          message
        });
      }
      return res.json({ success: true, message: "Lead captured" });
    } catch (e) {
      return res.status(500).json({ error: "Failed to save contact" });
    }
  }

  // ─── CHAT ENDPOINT ───
  if (path.includes('/kimani-ai-core/chat')) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { sessionId, message } = req.body;
    if (!sessionId || !message) return res.status(400).json({ error: "Missing sessionId or message" });

    try {
      const { profile, history } = await getSession(sessionId);

      // Local Logic (Fast)
      const momentum = calculateMomentum(message, history, { intentScore: 40 } as any);
      const variability = generateVariabilityDirective({ intentScore: 40 } as any, history);

      // AI Logic (Strategic Unified Call)
      const result = await generateResponse(message, history, profile, variability, momentum);
      const intent = result.intent;
      const cleanResponse = result.response;
      const bursts = cleanResponse.split("[BURST]").map(b => b.trim()).filter(b => b.length > 0);

      const userMsg = { role: "user", content: message, timestamp: new Date().toISOString() };
      const assistantMsg = { role: "assistant", content: bursts.join(" "), timestamp: new Date().toISOString() };
      history.push(userMsg as any, assistantMsg as any);

      // Background Saves (Non-blocking)
      const savePromises = [];
      if (process.env.SUPABASE_URL) {
        savePromises.push(saveClientProfileSupabase(profile as any));
        savePromises.push(logConversationMessageSupabase(sessionId, userMsg as any));
        savePromises.push(logConversationMessageSupabase(sessionId, assistantMsg as any));
        savePromises.push(saveLeadSupabase({
          sessionId,
          name: profile.name || "Anonymous",
          profession: profile.profession || "Chat Lead",
          stage: intent.stage,
          intentScore: intent.intentScore,
          discoverySummary: result.discoverySummary,
          fullConversation: history,
          capturedVia: "Vercel AI Native"
        }));
      }

      // Wait for saves but don't let them crash the response
      Promise.all(savePromises).catch(e => console.error("Save error:", e));

      return res.status(200).json({
        response: assistantMsg.content,
        bursts,
        intent: { score: intent.intentScore, stage: intent.stage, emotion: intent.emotion }
      });

    } catch (error: any) {
      console.error("Handler Error:", error);
      return res.status(500).json({ 
        error: "Brain connection timeout",
        details: error.message,
        fallback: "Hmm... lost my train of thought. Can you say that again?"
      });
    }
  }

  return res.status(404).json({ error: 'Not found', path });
}
