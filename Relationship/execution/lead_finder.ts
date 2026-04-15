import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { ProspectProfile } from "./email_types.js";
import "dotenv/config";

// ─── Lazy Client Factory ─────────────────────────────────────
function getAnthropicClient() {
  const activeKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
  const isOR = activeKey?.startsWith("sk-or-v1");
  
  if (isOR) {
    return {
      client: {
        messages: {
          create: async (params: any) => {
            const response = await axios.post(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                model: "anthropic/claude-3-haiku",
                messages: params.messages.map((m: any) => ({
                  role: m.role,
                  content: m.content
                })),
                system: params.system,
                max_tokens: params.max_tokens,
              },
              {
                headers: {
                  "Authorization": `Bearer ${activeKey}`,
                  "HTTP-Referer": "https://marketingwithkimani.co.ke",
                  "X-Title": "Marketing with Kimani",
                  "Content-Type": "application/json",
                },
              }
            );
            
            const choice = response.data.choices[0];
            return {
              content: [
                {
                  type: "text",
                  text: choice.message.content
                }
              ]
            };
          }
        }
      } as any,
      model: "anthropic/claude-3-haiku",
    };
  }

  return {
    client: new Anthropic({
      apiKey: activeKey,
    }),
    model: "claude-3-haiku-20240307",
  };
}

export async function findPotentialLeads(
  industry: string,
  targetRole: string,
  count: number = 3
): Promise<ProspectProfile[]> {
  console.log(`\n🔍 AI Lead Finder: Researching ${targetRole} leads in "${industry}" market...`);
  
  const { client: anthropic, model } = getAnthropicClient();

  const prompt = `Act as an expert market intelligence analyst. 
Generate ${count} realistic B2B leads for a marketing consultant targeting ${industry} across the entire African continent. Focus on hubs like Nairobi (Kenya), Lagos (Nigeria), Johannesburg (South Africa), Accra (Ghana), Kigali (Rwanda), Cairo (Egypt), and Casablanca (Morocco).

The target role should be around ${targetRole}.

For each lead, provide:
1. Full Name (authentic to the region)
2. Realistic Company Name
3. A likely email address matching the company domain
4. 2 specific market observations (e.g., expansion news, current challenges)
5. 1 specific pain point (e.g., trust gap, low customer retention)

Output ONLY valid JSON in this format:
[
  {
    "name": "Full Name",
    "companyName": "Company Name",
    "email": "email@domain.com",
    "observations": ["Obs 1", "Obs 2"],
    "painPoints": ["Pain Point info"]
  }
]`;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY");
    }

    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 2000,
      system: "You are a professional market intelligence engine. Return valid JSON only.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const generated = JSON.parse(text);

    return generated.map((l: any, i: number) => ({
      ...l,
      prospectId: `ai-find-${Date.now()}-${i}`,
      industry,
      role: targetRole,
      stage: "cold",
      notes: "A.I. Market Intelligence analysis",
      emailsSent: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      emailsReplied: 0,
      tags: ["AI Found", industry]
    }));

  } catch (error) {
    console.warn("AI generation for leads failed, using high-quality simulation fallback:", error);
    
    // Fallback if API fails or key is missing
    return [
      {
        prospectId: `find-${Date.now()}-1`,
        email: `director@${industry.toLowerCase().replace(/\s/g, '')}-group.co.ke`,
        name: `John Juma`,
        companyName: `${industry} Group East Africa`,
        industry: industry,
        role: targetRole,
        stage: "cold",
        observations: [
          "Company expanded to regional markets recently",
          "Website mentions trust-building as a core value"
        ],
        painPoints: ["Scaling human engagement across regions"],
        notes: "Fallback simulation",
        emailsSent: 0, emailsOpened: 0, emailsClicked: 0, emailsReplied: 0,
        tags: ["AI Found", industry]
      }
    ];
  }
}
