/**
 * Email Delivery Engine
 *
 * Handles SMTP sending of generated emails.
 */

import nodemailer from "nodemailer";
import { GeneratedEmail, ProspectProfile } from "./email_types.js";
import "dotenv/config";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a generated email to a prospect.
 */
export async function sendEmailToProspect(
  prospect: ProspectProfile,
  email: GeneratedEmail
): Promise<boolean> {
  console.log(`\n📧 Attempting to send email to: ${prospect.email}`);
  console.log(`Subject: ${email.subjectLine}`);

  const mailOptions = {
    from: `"${email.closingName}" <${process.env.SMTP_USER}>`,
    to: prospect.email,
    subject: email.subjectLine,
    text: email.body,
    html: email.body.replace(/\n/g, "<br>"),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${prospect.email}:`, error);
    return false;
  }
}
