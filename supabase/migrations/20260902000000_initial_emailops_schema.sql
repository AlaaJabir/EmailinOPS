-- ==============================================================================
-- Migration: Initial EmailOps Schema with Supabase Auth, Relational Tables & RLS
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked directly to Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
  plan TEXT NOT NULL DEFAULT 'PRO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on profile email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. AUTOMATIC USER PROFILE TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'ADMIN'),
    COALESCE(NEW.raw_user_meta_data->>'plan', 'PRO')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (runs after successful registration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. DOMAINS TABLE
CREATE TABLE IF NOT EXISTS public.domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  spf_status TEXT NOT NULL DEFAULT 'VERIFIED',
  dkim_status TEXT NOT NULL DEFAULT 'VERIFIED',
  dmarc_status TEXT NOT NULL DEFAULT 'VERIFIED',
  ses_status TEXT NOT NULL DEFAULT 'VERIFIED',
  dkim_selector TEXT NOT NULL DEFAULT 'kumo2026',
  dkim_public_key TEXT NOT NULL DEFAULT '',
  spf_record TEXT NOT NULL DEFAULT 'v=spf1 include:_spf.kumomta.internal include:amazonses.com ~all',
  dmarc_record TEXT NOT NULL DEFAULT 'v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@domain.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_domain UNIQUE (user_id, domain_name)
);

CREATE INDEX IF NOT EXISTS idx_domains_user ON public.domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_name ON public.domains(domain_name);

-- 4. SENDERS TABLE
CREATE TABLE IF NOT EXISTS public.senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'warming')),
  verification TEXT NOT NULL DEFAULT 'VERIFIED',
  daily_limit INTEGER NOT NULL DEFAULT 50000,
  hourly_limit INTEGER NOT NULL DEFAULT 5000,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  complaint_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_sender_email UNIQUE (user_id, from_email)
);

CREATE INDEX IF NOT EXISTS idx_senders_user ON public.senders(user_id);
CREATE INDEX IF NOT EXISTS idx_senders_email ON public.senders(from_email);

-- 5. CONTACT LISTS TABLE
CREATE TABLE IF NOT EXISTS public.contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_lists_user ON public.contact_lists(user_id);

-- 6. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED')),
  bounce_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_contact_email UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);

-- 7. CONTACT LIST MEMBERS TABLE (Many-to-Many join)
CREATE TABLE IF NOT EXISTS public.contact_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_list_contact UNIQUE (list_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_list_members_list ON public.contact_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_contact ON public.contact_list_members(contact_id);

-- 8. SUPPRESSIONS TABLE (Global and User compliance blocklist)
CREATE TABLE IF NOT EXISTS public.suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('UNSUBSCRIBED', 'HARD_BOUNCE', 'COMPLAINT', 'MANUAL')),
  reason TEXT NOT NULL DEFAULT 'Suppressed',
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_suppression_email UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_suppressions_user ON public.suppressions(user_id);
CREATE INDEX IF NOT EXISTS idx_suppressions_email ON public.suppressions(email);

-- 9. CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sender_id UUID REFERENCES public.senders(id) ON DELETE SET NULL,
  list_id UUID REFERENCES public.contact_lists(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL DEFAULT '',
  plain_text TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'COMPLETED', 'FAILED')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  complaint_count INTEGER NOT NULL DEFAULT 0,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

-- 10. MESSAGES TABLE (Real emails sent through KumoMTA -> SES)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  internal_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE, -- RFC 5322 Message-ID (e.g. <kumo.174...>)
  ses_message_id TEXT, -- Amazon SES mail.messageId
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sender_id UUID REFERENCES public.senders(id) ON DELETE SET NULL,
  from_name TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  reply_to TEXT,
  cc TEXT[] NOT NULL DEFAULT '{}',
  bcc TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL,
  html_body TEXT,
  plain_text TEXT,
  custom_headers JSONB,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED',
    'COMPLAINED', 'REJECTED', 'RENDERING_FAILED', 'DELIVERY_DELAYED'
  )),
  provider TEXT NOT NULL DEFAULT 'KumoMTA',
  provider_message_id TEXT,
  smtp_response TEXT,
  bounce_type TEXT,
  bounce_reason TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_rfc_id ON public.messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_ses_id ON public.messages(ses_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_internal_id ON public.messages(internal_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_to_email ON public.messages(to_email);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- 11. MESSAGE EVENTS TABLE (Lifecycle events: QUEUED, SENT, DELIVERED, BOUNCED, etc.)
CREATE TABLE IF NOT EXISTS public.message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL, -- references messages(message_id) or internal_id
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  geo TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_events_msg_id ON public.message_events(message_id);
CREATE INDEX IF NOT EXISTS idx_message_events_user ON public.message_events(user_id);
CREATE INDEX IF NOT EXISTS idx_message_events_type ON public.message_events(event_type);
CREATE INDEX IF NOT EXISTS idx_message_events_time ON public.message_events(timestamp DESC);

-- 12. TECHNICAL LOGS TABLE
CREATE TABLE IF NOT EXISTS public.technical_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  service TEXT NOT NULL,
  message_id TEXT,
  event TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'SUCCESS')),
  response TEXT NOT NULL,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_logs_user ON public.technical_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_service ON public.technical_logs(service);
CREATE INDEX IF NOT EXISTS idx_logs_time ON public.technical_logs(timestamp DESC);

-- 13. API KEYS TABLE
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);

-- 14. PROCESSED WEBHOOK EVENTS TABLE (SNS Event Idempotency & Deduplication)
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE, -- SNS MessageId or event identifier
  provider TEXT NOT NULL DEFAULT 'SES_SNS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_events_id ON public.processed_webhook_events(event_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Domains Policies
CREATE POLICY "Users can view their own domains"
  ON public.domains FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own domains"
  ON public.domains FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own domains"
  ON public.domains FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own domains"
  ON public.domains FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Senders Policies
CREATE POLICY "Users can view their own senders"
  ON public.senders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own senders"
  ON public.senders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own senders"
  ON public.senders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own senders"
  ON public.senders FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Contact Lists Policies
CREATE POLICY "Users can view their own contact lists"
  ON public.contact_lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact lists"
  ON public.contact_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contact lists"
  ON public.contact_lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact lists"
  ON public.contact_lists FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Contacts Policies
CREATE POLICY "Users can view their own contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Contact List Members Policies
CREATE POLICY "Users can manage their own list memberships"
  ON public.contact_list_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.contact_lists cl
      WHERE cl.id = list_id AND cl.user_id = auth.uid()
    )
  );

-- 7. Suppressions Policies
CREATE POLICY "Users can view their own suppressions"
  ON public.suppressions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suppressions"
  ON public.suppressions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suppressions"
  ON public.suppressions FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Campaigns Policies
CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Messages Policies
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. Message Events Policies
CREATE POLICY "Users can view their own message events"
  ON public.message_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own message events"
  ON public.message_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 11. Technical Logs Policies
CREATE POLICY "Users can view their own technical logs"
  ON public.technical_logs FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own technical logs"
  ON public.technical_logs FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 12. API Keys Policies
CREATE POLICY "Users can view their own api keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own api keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own api keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);
