-- Run this SQL in your Supabase SQL Editor to set up the necessary tables.

-- Profiles table for AI memory
CREATE TABLE IF NOT EXISTS profiles (
  "clientId" TEXT PRIMARY KEY,
  "name" TEXT,
  "age" TEXT,
  "profession" TEXT,
  "goals" JSONB DEFAULT '[]',
  "challenges" JSONB DEFAULT '[]',
  "interests" JSONB DEFAULT '[]',
  "financialConcerns" JSONB DEFAULT '[]',
  "healthConcerns" JSONB DEFAULT '[]',
  "familyReferences" JSONB DEFAULT '[]',
  "lifeEvents" JSONB DEFAULT '[]',
  "preferredTone" TEXT DEFAULT 'friendly',
  "previousQuestions" JSONB DEFAULT '[]',
  "timelineEvents" JSONB DEFAULT '[]',
  "intentHistory" JSONB DEFAULT '[]',
  "lastContactDate" TEXT,
  "conversationCount" INTEGER DEFAULT 0,
  "messageCount" INTEGER DEFAULT 0,
  "disclosureLevel" INTEGER DEFAULT 0,
  "country" TEXT,
  "notes" TEXT DEFAULT ''
);

-- Conversations table for chat logs
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  "clientId" TEXT REFERENCES profiles("clientId") ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT,
  timestamp TEXT
);

-- Leads table for contact form & combined dashboard views
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  company TEXT,
  stage TEXT,
  "capturedVia" TEXT,
  interest TEXT,
  message TEXT,
  "sessionId" TEXT,
  "intentScore" INTEGER,
  "discoverySummary" TEXT,
  "suggestedNextAction" TEXT,
  "fullConversation" JSONB,
  timestamp TEXT
);
