import { createClient } from "@supabase/supabase-js";
import { ClientProfile, ConversationMessage } from "./types.js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * Load a client profile by ID using Supabase.
 */
export async function loadClientProfile(clientId: string): Promise<ClientProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("clientId", clientId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Supabase load error:", error);
    return null;
  }

  return data as ClientProfile;
}

/**
 * Save a client profile to Supabase.
 */
export async function saveClientProfile(profile: ClientProfile): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "clientId" });

  if (error) {
    console.error("Supabase save error:", error);
    throw error;
  }
}

/**
 * Log a conversation message to Supabase.
 */
export async function logConversationMessage(clientId: string, message: ConversationMessage): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("conversations")
    .insert({
      clientId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp
    });

  if (error) {
    console.error("Supabase log error:", error);
    throw error;
  }
}

/**
 * Load recent conversation history for a client from Supabase.
 */
export async function loadConversationHistory(clientId: string, limit: number = 20): Promise<ConversationMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("conversations")
    .select("role, content, timestamp")
    .eq("clientId", clientId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase load history error:", error);
    return [];
  }

  // Supabase returns latest first because of order, we want chronological for the AI
  return (data as ConversationMessage[]).reverse();
}

/**
 * Save lead/interaction data to Supabase leads table.
 */
export async function saveLead(lead: any): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("leads")
    .insert([
      {
        ...lead,
        timestamp: new Date().toISOString()
      }
    ]);

  if (error) {
    console.error("Supabase lead save error:", error);
    throw error;
  }
}

/**
 * Fetch all leads from Supabase.
 */
export async function loadLeadsFromSupabase() {
  if (!supabase) return { data: [], error: new Error("Supabase not initialized") };
  return await supabase
    .from("leads")
    .select("*")
    .order("timestamp", { ascending: false });
}
