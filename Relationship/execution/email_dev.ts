/**
 * Email Intelligence — Local Development CLI
 *
 * Interactive tool for testing email generation locally.
 * No Google Sheets or Trigger.dev required — just ANTHROPIC_API_KEY.
 *
 * Commands:
 *   npx tsx execution/email_dev.ts single     — Generate one email
 *   npx tsx execution/email_dev.ts campaign   — Generate full 5-email sequence
 *   npx tsx execution/email_dev.ts hooks      — Generate lead capture hooks
 */

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateEmail, generateFullCampaign } from "./email_engine.js";
import { generateLeadCapture, generateHookVariants, scoreHook } from "./lead_capture.js";
import { ProspectProfile, CampaignPosition } from "./email_types.js";

// ─── Configuration ───────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        if (value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

// ─── Demo Prospect ───────────────────────────────────────────

const DEMO_PROSPECT: ProspectProfile = {
  prospectId: "demo-001",
  email: "sarah@examplecorp.com",
  name: "Sarah",
  companyName: "ExampleCorp",
  companyUrl: "https://examplecorp.com",
  industry: "SaaS",
  role: "VP of Sales",
  stage: "cold",
  observations: [
    "Website shows they focus on B2B sales",
    "Team of ~50 people based on LinkedIn",
    "Currently using a basic CRM with no AI",
  ],
  painPoints: [
    "Likely slow lead response times",
    "Manual follow-up processes",
  ],
  notes: "",
  emailsSent: 0,
  emailsOpened: 0,
  emailsClicked: 0,
  emailsReplied: 0,
  tags: [],
};

const DEMO_CONFIG = {
  productOrService: "AI-powered relationship management system that handles initial customer conversations naturally",
  valueProposition: "Companies using our system see 3x faster lead response times and 40% higher conversion rates because the AI builds real relationships instead of sending robotic auto-replies",
  companyName: "RelationshipAI",
  senderName: "Daniel",
  senderRole: "Head of Growth",
};

// ─── Formatters ──────────────────────────────────────────────

function printEmail(email: { subjectLine: string; body: string }, index?: number) {
  const header = index !== undefined ? `EMAIL ${index + 1}` : "EMAIL";
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │ ${header.padEnd(55)} │
  ├─────────────────────────────────────────────────────────┤
  │ Subject: ${email.subjectLine.substring(0, 46).padEnd(46)} │
  └─────────────────────────────────────────────────────────┘
`);
  // Print body with indentation
  const lines = email.body.split("\n");
  for (const line of lines) {
    console.log(`    ${line}`);
  }
  console.log();
}

function printHook(hook: { headline: string; curiosityExpansion: string; capturePrompt: string; captureButtonText: string }, index?: number) {
  const header = index !== undefined ? `HOOK VARIANT ${index + 1}` : "LEAD CAPTURE HOOK";
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │ ${header.padEnd(55)} │
  ├─────────────────────────────────────────────────────────┤
  │ Headline:                                               │
  └─────────────────────────────────────────────────────────┘
    "${hook.headline}"

    --- Curiosity Expansion ---
${hook.curiosityExpansion.split("\n").map((l: string) => `    ${l}`).join("\n")}

    --- Capture Moment ---
    ${hook.capturePrompt}
    [ ${hook.captureButtonText} ]
`);
}

// ─── Commands ────────────────────────────────────────────────

async function runSingle() {
  console.log("\n  Generating a single email (curiosity_trigger)...\n");

  const result = await generateEmail({
    prospect: DEMO_PROSPECT,
    campaignPosition: "curiosity_trigger",
    ...DEMO_CONFIG,
  });

  printEmail(result.email);

  console.log(`  Strategy: ${result.email.strategy.persuasionAngle}`);
  console.log(`  CTA: ${result.email.strategy.callToAction}`);
  console.log(`  Next: ${result.nextAction}`);
  console.log(`  Pattern breakers: ${result.email.patternBreakers.join(", ")}`);
  console.log(`  Read time: ${result.email.estimatedReadTime}\n`);
}

async function runCampaign() {
  console.log("\n  Generating full 5-email campaign sequence...\n");

  const results = await generateFullCampaign({
    prospect: DEMO_PROSPECT,
    ...DEMO_CONFIG,
  });

  for (let i = 0; i < results.length; i++) {
    const positions = ["CURIOSITY TRIGGER", "INSIGHT EXPANSION", "STRATEGIC PERSPECTIVE", "DIRECT OFFER", "FINAL CLOSE"];
    console.log(`  ═══ ${positions[i]} ═══`);
    printEmail(results[i].email, i);
    console.log(`  → Next: ${results[i].nextAction}`);
    console.log(`  → Delay: ${results[i].suggestedDelay} days\n`);
  }
}

async function runHooks() {
  console.log("\n  Generating lead capture hook variants...\n");

  const variants = await generateHookVariants(
    "SaaS",
    DEMO_CONFIG.productOrService,
    3
  );

  for (let i = 0; i < variants.length; i++) {
    printHook(variants[i], i);

    const { score, feedback } = scoreHook(variants[i]);
    console.log(`    Score: ${score}/100`);
    for (const f of feedback) {
      console.log(`    • ${f}`);
    }
    console.log();
  }
}

async function runLeadCapture() {
  console.log("\n  Generating full lead capture page content...\n");

  const page = await generateLeadCapture(
    "SaaS",
    DEMO_CONFIG.productOrService,
    "VP of Sales at mid-size B2B companies",
    DEMO_CONFIG.valueProposition
  );

  printHook(page.hook);

  console.log("  --- Credibility Statement ---");
  console.log(`    ${page.credibilityStatement}\n`);
  console.log("  --- Trust Transfer ---");
  console.log(`    ${page.trustTransferLine}\n`);
  console.log(`  Form fields: ${page.formFields.join(", ")}`);
  console.log(`  Target emotion: ${page.targetEmotion}\n`);

  const { score, feedback } = scoreHook(page.hook);
  console.log(`  Hook Score: ${score}/100`);
  for (const f of feedback) {
    console.log(`  • ${f}`);
  }
  console.log();
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`
╔══════════════════════════════════════════════════════╗
║   Email Intelligence — Local Development Mode        ║
╠══════════════════════════════════════════════════════╣
║  Commands:                                           ║
║    single   — Generate one email                     ║
║    campaign — Full 5-email sequence                  ║
║    hooks    — Lead capture hook variants              ║
║    capture  — Full lead capture page content          ║
║    quit     — Exit                                   ║
╚══════════════════════════════════════════════════════╝
`);

  const prompt = () => {
    rl.question("  email> ", async (input) => {
      const cmd = input.trim().toLowerCase();

      if (cmd === "quit" || cmd === "exit") {
        console.log("\n  Goodbye! 👋\n");
        rl.close();
        process.exit(0);
      }

      try {
        switch (cmd) {
          case "single":
            await runSingle();
            break;
          case "campaign":
            await runCampaign();
            break;
          case "hooks":
            await runHooks();
            break;
          case "capture":
            await runLeadCapture();
            break;
          default:
            console.log("  Unknown command. Try: single, campaign, hooks, capture, quit");
        }
      } catch (error: any) {
        console.error(`\n  ❌ Error: ${error.message || error}`);
        if (error.status === 401) {
          console.error("     → Check your ANTHROPIC_API_KEY in .env");
        }
      }

      prompt();
    });
  };

  prompt();
}

// ─── Entry Point ─────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set in .env or environment.");
    process.exit(1);
  }

  const command = process.argv[2];

  switch (command) {
    case "single":
      await runSingle();
      break;
    case "campaign":
      await runCampaign();
      break;
    case "hooks":
      await runHooks();
      break;
    case "capture":
      await runLeadCapture();
      break;
    default:
      await runInteractive();
  }
}

main().catch(console.error);
