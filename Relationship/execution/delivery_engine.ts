/**
 * Email Delivery Engine
 *
 * Handles SMTP sending of generated emails.
 */

import nodemailer from "nodemailer";
import { GeneratedEmail, ProspectProfile } from "./email_types.js";
import "dotenv/config";

// Configuration for Purelymail
const SMTP_CONFIG = {
  host: "smtp.purelymail.com",
  port: 465,
  secure: true, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER || "automations@marketingwithkimani.co.ke",
    pass: process.env.SMTP_PASS,
  },
};

const automationsTransporter = nodemailer.createTransport(SMTP_CONFIG);

// If they share the same credentials but different 'from' addresses, 
// purelymail usually allows this if they are on the same account.
// If they need separate auth, we'd create a second one.
const enquiriesTransporter = nodemailer.createTransport({
  ...SMTP_CONFIG,
  auth: {
    user: process.env.SMTP_ENQUIRIES_USER || "enquiries@marketingwithkimani.co.ke",
    pass: process.env.SMTP_ENQUIRIES_PASS || process.env.SMTP_PASS,
  }
});

/**
 * Send a generated email to a prospect.
 * @param senderType 'automations' (default) or 'enquiries'
 */
export async function sendEmailToProspect(
  prospect: ProspectProfile,
  email: GeneratedEmail,
  senderType: 'automations' | 'enquiries' = 'automations'
): Promise<boolean> {
  const transporter = senderType === 'enquiries' ? enquiriesTransporter : automationsTransporter;
  const fromEmail = senderType === 'enquiries' 
    ? "enquiries@marketingwithkimani.co.ke" 
    : "automations@marketingwithkimani.co.ke";

  console.log(`\n📧 Attempting to send email [via ${senderType}] to: ${prospect.email}`);
  console.log(`Subject: ${email.subjectLine}`);

  const mailOptions = {
    from: `"${email.closingName || 'Kimani'}" <${fromEmail}>`,
    to: prospect.email,
    subject: email.subjectLine,
    text: email.body,
    html: email.body.replace(/\n/g, "<br>"),
  };

  try {
    if (!transporter.options.auth?.pass) {
      throw new Error("SMTP Password (SMTP_PASS) is missing in environment variables.");
    }
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ STMP ERROR when sending to ${prospect.email}:`, error);
    // Provide a clearer message for common errors
    if (error.code === 'EAUTH') console.error("   Reason: Authentication failed (check user/pass)");
    if (error.code === 'ESOCKET') console.error("   Reason: Connection timed out or DNS error");
    return false;
  }
}
