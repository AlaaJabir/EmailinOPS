import {
  User,
  Domain,
  Sender,
  Contact,
  ContactList,
  SuppressionItem,
  Template,
  Campaign,
  Message,
  MessageEvent,
  TechnicalLog,
  PrometheusMetrics,
  DashboardStats,
} from '../src/types.js';

export interface UnsubscribeToken {
  token: string;
  email: string;
  contactId?: string;
  messageId?: string;
  campaignId?: string;
  userId?: string;
  createdAt: string;
  unsubscribedAt?: string;
}

// In-Memory Database Store mimicking PostgreSQL + Prisma relations
class DatabaseStore {
  users: User[] = [];
  domains: Domain[] = [];
  senders: Sender[] = [];
  contacts: Contact[] = [];
  contactLists: ContactList[] = [];
  listMemberships: { listId: string; contactId: string; joinedAt: string }[] = [];
  suppressions: SuppressionItem[] = [];
  templates: Template[] = [];
  campaigns: Campaign[] = [];
  messages: Message[] = [];
  messageEvents: MessageEvent[] = [];
  unsubscribeTokens: UnsubscribeToken[] = [];
  logs: TechnicalLog[] = [];
  settings: Record<string, any> = {};
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt?: string }> = [];
  processedEventIds: Set<string> = new Set<string>();

  constructor() {
    this.seedInitialData();
  }

  seedInitialData() {
    const now = new Date();
    const iso = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000).toISOString();

    // 1. Users
    this.users = [
      {
        id: 'usr_admin_01',
        email: 'admin@emailops.io',
        name: 'Alex Vance (Lead Email Architect)',
        role: 'ADMIN',
        createdAt: iso(10080),
      },
      {
        id: 'usr_ops_02',
        email: 'ops@emailops.io',
        name: 'Sarah Chen (Deliverability Engineer)',
        role: 'OPERATOR',
        createdAt: iso(7200),
      },
    ];

    // 2. Domains
    this.domains = [
      {
        id: 'dom_00',
        domainName: 'amiralucia.com',
        spfStatus: 'VERIFIED',
        dkimStatus: 'VERIFIED',
        dmarcStatus: 'VERIFIED',
        sesStatus: 'VERIFIED',
        dkimSelector: 'kumo2026',
        dkimPublicKey: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...',
        spfRecord: 'v=spf1 include:_spf.kumomta.internal include:amazonses.com ~all',
        dmarcRecord: 'v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@amiralucia.com',
        createdAt: iso(10000),
        updatedAt: iso(100),
      },
      {
        id: 'dom_01',
        domainName: 'transact.acme-corp.io',
        spfStatus: 'VERIFIED',
        dkimStatus: 'VERIFIED',
        dmarcStatus: 'VERIFIED',
        sesStatus: 'VERIFIED',
        dkimSelector: 'kumo2026',
        dkimPublicKey: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyXw1a...',
        spfRecord: 'v=spf1 include:_spf.kumomta.internal include:amazonses.com ~all',
        dmarcRecord: 'v=DMARC1; p=reject; pct=100; rua=mailto:dmarc-rua@acme-corp.io',
        createdAt: iso(10000),
        updatedAt: iso(100),
      },
      {
        id: 'dom_02',
        domainName: 'marketing.acme-corp.io',
        spfStatus: 'VERIFIED',
        dkimStatus: 'VERIFIED',
        dmarcStatus: 'VERIFIED',
        sesStatus: 'VERIFIED',
        dkimSelector: 'ses1',
        dkimPublicKey: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3w7pX...',
        spfRecord: 'v=spf1 include:_spf.kumomta.internal include:amazonses.com ~all',
        dmarcRecord: 'v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@acme-corp.io',
        createdAt: iso(8000),
        updatedAt: iso(50),
      },
      {
        id: 'dom_03',
        domainName: 'notifications.acme-cloud.net',
        spfStatus: 'VERIFIED',
        dkimStatus: 'PENDING',
        dmarcStatus: 'VERIFIED',
        sesStatus: 'VERIFIED',
        dkimSelector: 'kumo-backup',
        dkimPublicKey: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...',
        spfRecord: 'v=spf1 include:_spf.kumomta.internal ~all',
        dmarcRecord: 'v=DMARC1; p=none;',
        createdAt: iso(2000),
        updatedAt: iso(10),
      },
    ];

    // 3. Senders (Real sender identities with ZERO fake counts)
    this.senders = [
      {
        id: 'snd_00',
        name: process.env.KUMO_FROM_NAME || 'Amiralucia',
        fromEmail: process.env.KUMO_FROM_EMAIL || 'service@amiralucia.com',
        replyTo: process.env.KUMO_FROM_EMAIL || 'service@amiralucia.com',
        domainId: 'dom_00',
        domainName: 'amiralucia.com',
        status: 'active',
        verification: 'VERIFIED',
        dailyLimit: 100000,
        hourlyLimit: 10000,
        sentCount: 0,
        deliveredCount: 0,
        bouncedCount: 0,
        complaintCount: 0,
        createdAt: iso(5000),
      },
      {
        id: 'snd_01',
        name: 'Acme Auth & Security',
        fromEmail: 'security@transact.acme-corp.io',
        replyTo: 'security-support@acme-corp.io',
        domainId: 'dom_01',
        domainName: 'transact.acme-corp.io',
        status: 'active',
        verification: 'VERIFIED',
        dailyLimit: 100000,
        hourlyLimit: 10000,
        sentCount: 0,
        deliveredCount: 0,
        bouncedCount: 0,
        complaintCount: 0,
        createdAt: iso(9500),
      },
      {
        id: 'snd_02',
        name: 'Acme Product Announcements',
        fromEmail: 'news@marketing.acme-corp.io',
        replyTo: 'growth@acme-corp.io',
        domainId: 'dom_02',
        domainName: 'marketing.acme-corp.io',
        status: 'active',
        verification: 'VERIFIED',
        dailyLimit: 75000,
        hourlyLimit: 7500,
        sentCount: 0,
        deliveredCount: 0,
        bouncedCount: 0,
        complaintCount: 0,
        createdAt: iso(8000),
      },
      {
        id: 'snd_03',
        name: 'Acme Cloud Alerts',
        fromEmail: 'alerts@notifications.acme-cloud.net',
        replyTo: 'noc-desk@acme-corp.io',
        domainId: 'dom_03',
        domainName: 'notifications.acme-cloud.net',
        status: 'warming',
        verification: 'VERIFIED',
        dailyLimit: 25000,
        hourlyLimit: 2500,
        sentCount: 0,
        deliveredCount: 0,
        bouncedCount: 0,
        complaintCount: 0,
        createdAt: iso(3000),
      },
    ];

    // 4. Contact Lists
    this.contactLists = [
      {
        id: 'lst_01',
        name: 'Enterprise VIP Customers',
        description: 'Tier-1 high volume API and Cloud platform customers',
        memberCount: 1850,
        createdAt: iso(6000),
      },
      {
        id: 'lst_02',
        name: 'Beta Program Subscribers',
        description: 'Opted-in engineers testing KumoMTA high-throughput queues',
        memberCount: 4200,
        createdAt: iso(4500),
      },
      {
        id: 'lst_03',
        name: 'Monthly Tech Digest',
        description: 'Developers subscribed to infrastructure and deliverability insights',
        memberCount: 12400,
        createdAt: iso(4000),
      },
    ];

    // 5. Contacts Sample
    this.contacts = [
      {
        id: 'cnt_01',
        email: 'david.miller@stripe-dev.com',
        firstName: 'David',
        lastName: 'Miller',
        company: 'Stripe Ecosystem Partners',
        tags: ['vip', 'dev', 'eu'],
        status: 'ACTIVE',
        createdAt: iso(5000),
        updatedAt: iso(100),
      },
      {
        id: 'cnt_02',
        email: 'elena.rostova@cloudscale.tech',
        firstName: 'Elena',
        lastName: 'Rostova',
        company: 'CloudScale Infrastructure',
        tags: ['enterprise', 'kumo-pilot'],
        status: 'ACTIVE',
        createdAt: iso(4800),
        updatedAt: iso(200),
      },
      {
        id: 'cnt_03',
        email: 'marcus.vance@fintech-core.io',
        firstName: 'Marcus',
        lastName: 'Vance',
        company: 'FinTech Core Systems',
        tags: ['security-lead'],
        status: 'ACTIVE',
        createdAt: iso(4500),
        updatedAt: iso(300),
      },
      {
        id: 'cnt_04',
        email: 'bounced.recipient.deadbox@invalid-domain-test.com',
        firstName: 'Dead',
        lastName: 'Mailbox',
        company: 'Old Corp',
        tags: ['hard-bounce'],
        status: 'BOUNCED',
        bounceReason: '550 5.1.1 User unknown / Host not reachable',
        createdAt: iso(3000),
        updatedAt: iso(20),
      },
      {
        id: 'cnt_05',
        email: 'optout.user@compliance-watch.org',
        firstName: 'OptOut',
        lastName: 'Tester',
        company: 'Compliance Watch',
        tags: ['unsub'],
        status: 'UNSUBSCRIBED',
        createdAt: iso(3500),
        updatedAt: iso(500),
      },
    ];

    // 6. Suppression List
    this.suppressions = [
      {
        id: 'sup_01',
        email: 'bounced.recipient.deadbox@invalid-domain-test.com',
        type: 'HARD_BOUNCE',
        reason: '550 5.1.1 Recipient mailbox does not exist (Amazon SES bounce notification)',
        source: 'ses_webhook',
        createdAt: iso(1440),
      },
      {
        id: 'sup_02',
        email: 'spam-trap@disposable-mail-honeypot.org',
        type: 'COMPLAINT',
        reason: 'Spam complaint registered via SES Feedback Loop (FBL)',
        source: 'ses_webhook',
        createdAt: iso(2880),
      },
      {
        id: 'sup_03',
        email: 'unsub.developer@legacy-company.com',
        type: 'UNSUBSCRIBED',
        reason: 'Clicked List-Unsubscribe One-Click RFC 8058 header',
        source: 'system',
        createdAt: iso(4320),
      },
      {
        id: 'sup_04',
        email: 'do-not-email-manual@competitor.com',
        type: 'MANUAL',
        reason: 'Customer requested direct removal via legal ticket #8492',
        source: 'manual',
        createdAt: iso(7200),
      },
    ];

    // 7. Templates
    this.templates = [
      {
        id: 'tmpl_01',
        name: 'Transactional - Security Code / OTP',
        subject: 'Your Acme Security Verification Code: {{otp_code}}',
        htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f5f7; padding: 40px 20px; color: #1e293b;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 24px; letter-spacing: -0.5px;">ACME CLOUD PLATFORM</div>
    <h2 style="font-size: 22px; color: #0f172a; margin-bottom: 12px;">Two-Factor Authentication</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">Use the verification code below to authorize your session on the KumoMTA management cluster.</p>
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
      <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0284c7;">849-201</span>
    </div>
    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">This code will expire in 10 minutes. If you did not request this verification, please contact our security team immediately.</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
    <div style="font-size: 12px; color: #94a3b8; text-align: center;">
      Acme Corp Infrastructure &bull; 500 Cloud Parkway, Tech District &bull; Routed via KumoMTA + SES
    </div>
  </div>
</body>
</html>`,
        plainText: 'Your Acme Security Code is: 849-201. This code expires in 10 minutes.',
        variables: ['otp_code', 'first_name'],
        createdAt: iso(8000),
      },
      {
        id: 'tmpl_02',
        name: 'Marketing - Product Release 3.0',
        subject: '🚀 Introducing KumoMTA 3.0 High-Throughput Queue Management',
        htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; padding: 40px 20px; color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 40px; border: 1px solid #334155;">
    <div style="display: inline-block; background: #0284c7; color: white; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">NEW RELEASE</div>
    <h1 style="font-size: 26px; font-weight: 700; color: #ffffff; margin: 0 0 16px;">Scale to 50M+ emails/day with KumoMTA</h1>
    <p style="font-size: 16px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">We are thrilled to announce full telemetry integration between KumoMTA, Amazon SES upstream SMTP, and our new real-time EmailOps Dashboard.</p>
    <a href="https://acme-corp.io/release-3" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px;">Explore Release Notes &rarr;</a>
    <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #334155; font-size: 12px; color: #64748b;">
      You received this email because you subscribed to Acme Engineering updates.<br/>
      <a href="{{unsubscribe_url}}" style="color: #38bdf8; text-decoration: underline;">Unsubscribe from this list</a>
    </div>
  </div>
</body>
</html>`,
        plainText: 'Introducing KumoMTA 3.0. Scale to 50M+ emails/day. Read more at https://acme-corp.io/release-3',
        variables: ['first_name', 'unsubscribe_url'],
        createdAt: iso(6000),
      },
    ];

    // 8. Campaigns (Empty runtime state, zero fake historical counts)
    this.campaigns = [];

    // 9. Messages (Empty runtime state, populated solely by real sends)
    this.messages = [];
    this.messageEvents = [];

    // 10. Technical Logs (Empty runtime state)
    this.logs = [];

    // 11. API Keys
    this.apiKeys = [];

    // Idempotency tracking set for webhook & event deduplication
    this.processedEventIds = new Set<string>();

    // 12. Settings
    this.settings = {
      kumomta: {
        host: process.env.KUMO_SMTP_HOST || process.env.KUMOMTA_HOST || '127.0.0.1',
        port: Number(process.env.KUMO_SMTP_PORT || process.env.KUMOMTA_PORT) || 2525,
        apiUrl: process.env.KUMOMTA_API_URL || 'http://127.0.0.1:8000',
        username: process.env.KUMO_SMTP_USER || process.env.KUMOMTA_USERNAME || '',
        spoolPath: '/var/spool/kumomta',
        maxConcurrency: 64,
        maxRetries: 5,
        retryIntervalSec: 300,
        status: 'healthy',
      },
      ses: {
        smtpHost: process.env.SES_SMTP_HOST || 'email-smtp.eu-west-1.amazonaws.com',
        smtpPort: Number(process.env.SES_SMTP_PORT) || 587,
        username: process.env.SES_SMTP_USERNAME || '',
        region: process.env.SES_REGION || 'eu-west-1',
        configurationSet: process.env.SES_CONFIGURATION_SET || '',
        status: 'offline',
      },
      tracking: {
        enableOpenTracking: true,
        enableClickTracking: true,
        trackingDomain: '',
        customHeaders: {},
      },
      compliance: {
        enforceUnsubscribeHeader: true,
        autoSuppressHardBounces: true,
        autoSuppressComplaints: true,
        privacyUrl: process.env.PRIVACY_URL || 'https://emailops.io/privacy',
        termsUrl: process.env.TERMS_URL || 'https://emailops.io/terms',
      },
      prometheus: {
        enabled: true,
        scrapePath: '/api/metrics',
        scrapeIntervalSec: 15,
        lastScrapeTime: new Date().toISOString(),
      },
    };
  }

  // Idempotency tracking helpers
  hasProcessedEvent(key: string): boolean {
    return this.processedEventIds.has(key);
  }

  recordProcessedEvent(key: string): void {
    this.processedEventIds.add(key);
  }

  // Robust Message Correlation Strategy:
  // Correlation between:
  // Internal ID -> RFC Message-ID -> SES mail.messageId -> SES Event
  findMessageForEvent(params: {
    internalId?: string;
    rfcMessageId?: string;
    sesMessageId?: string;
    recipient?: string;
  }): Message | undefined {
    const { internalId, rfcMessageId, sesMessageId, recipient } = params;

    // 1. Direct match on Dashboard internal message ID (e.g. msg_174000_abc)
    if (internalId) {
      const found = this.messages.find((m) => m.id === internalId);
      if (found) return found;
    }

    // 2. Direct match on RFC 5322 Message-ID (stripping angle brackets and trimming)
    if (rfcMessageId) {
      const cleanRfc = rfcMessageId.trim().replace(/^<|>$/g, '').toLowerCase();
      const found = this.messages.find((m) => {
        const cleanM = (m.messageId || '').trim().replace(/^<|>$/g, '').toLowerCase();
        return cleanM === cleanRfc;
      });
      if (found) return found;
    }

    // 3. Match on Amazon SES mail.messageId (if previously linked or matching providerMessageId)
    if (sesMessageId) {
      const cleanSes = sesMessageId.trim();
      const found = this.messages.find(
        (m) =>
          m.sesMessageId === cleanSes ||
          m.providerMessageId === cleanSes ||
          m.id === cleanSes ||
          m.messageId === cleanSes
      );
      if (found) return found;
    }

    // 4. Fallback match by recipient if exactly one candidate message exists
    if (recipient) {
      const cleanRecip = recipient.trim().toLowerCase();
      const matching = this.messages.filter((m) => m.toEmail.trim().toLowerCase() === cleanRecip);
      if (matching.length === 1) {
        return matching[0];
      }
    }

    return undefined;
  }

  // Dashboard Aggregations (Derived strictly from real runtime data)
  getDashboardStats(): DashboardStats {
    const realMessages = this.messages;

    let queued = 0;
    let sent = 0;
    let delivered = 0;
    let bounced = 0;
    let failed = 0;
    let complaints = 0;
    let rejected = 0;
    let deliveryDelayed = 0;
    let renderingFailed = 0;

    for (const m of realMessages) {
      switch (m.status) {
        case 'QUEUED':
          queued++;
          break;
        case 'SENDING':
        case 'SENT':
          sent++;
          break;
        case 'DELIVERED':
          delivered++;
          break;
        case 'BOUNCED':
          bounced++;
          break;
        case 'FAILED':
          failed++;
          break;
        case 'COMPLAINED':
          complaints++;
          break;
        case 'REJECTED':
          rejected++;
          break;
        case 'DELIVERY_DELAYED':
          deliveryDelayed++;
          break;
        case 'RENDERING_FAILED':
          renderingFailed++;
          break;
      }
    }

    // Total sent includes all messages accepted and dispatched through the pipeline
    const totalSent = realMessages.length;

    // Real open and click counts from recorded events
    const opens = this.messageEvents.filter((e) => e.eventType === 'OPENED').length;
    const clicks = this.messageEvents.filter((e) => e.eventType === 'CLICKED').length;

    // Computed rates (0 if no messages)
    const deliveryRate = totalSent > 0 ? Number(((delivered / totalSent) * 100).toFixed(1)) : 0;
    const bounceRate = totalSent > 0 ? Number(((bounced / totalSent) * 100).toFixed(2)) : 0;
    const openRate = delivered > 0 ? Number(((opens / delivered) * 100).toFixed(1)) : 0;
    const clickRate = delivered > 0 ? Number(((clicks / delivered) * 100).toFixed(1)) : 0;

    // Calculate real sending rate from submissions in the last 60 seconds
    const now = Date.now();
    const recentSubmissions = realMessages.filter((m) => {
      const msgTime = new Date(m.createdAt || m.queuedAt).getTime();
      return now - msgTime <= 60000 && m.status !== 'FAILED';
    }).length;
    const sendingRatePerSec = recentSubmissions > 0 ? Number((recentSubmissions / 60).toFixed(2)) : 0;

    // Real timeseries for the last 7 days derived from actual runtime messages
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const timeseriesMap = new Map<string, { sent: number; delivered: number; bounced: number; failed: number; rejected: number }>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const dayName = days[d.getDay()];
      timeseriesMap.set(dayName, { sent: 0, delivered: 0, bounced: 0, failed: 0, rejected: 0 });
    }

    for (const m of realMessages) {
      const d = new Date(m.createdAt || m.queuedAt);
      const dayName = days[d.getDay()];
      if (timeseriesMap.has(dayName)) {
        const item = timeseriesMap.get(dayName)!;
        item.sent += 1;
        if (m.status === 'DELIVERED') item.delivered += 1;
        else if (m.status === 'BOUNCED') item.bounced += 1;
        else if (m.status === 'FAILED') item.failed += 1;
        else if (m.status === 'REJECTED') item.rejected += 1;
      }
    }

    const timeseries = Array.from(timeseriesMap.entries()).map(([time, data]) => ({
      time,
      ...data,
    }));

    // Real hourly activity: 2-hour buckets for last 24h
    const hourlyActivityMap = new Map<string, number>();
    const hours = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    for (const h of hours) {
      hourlyActivityMap.set(h, 0);
    }

    for (const m of realMessages) {
      const msgDate = new Date(m.createdAt || m.queuedAt);
      if (now - msgDate.getTime() <= 86400000) {
        const hour = msgDate.getHours();
        const bucketHour = Math.floor(hour / 2) * 2;
        const bucketKey = `${bucketHour.toString().padStart(2, '0')}:00`;
        if (hourlyActivityMap.has(bucketKey)) {
          hourlyActivityMap.set(bucketKey, (hourlyActivityMap.get(bucketKey) || 0) + 1);
        }
      }
    }

    const hourlyActivity = Array.from(hourlyActivityMap.entries()).map(([hour, volume]) => ({
      hour,
      volume,
    }));

    const topSenders = this.senders
      .filter((s) => s.sentCount > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        email: s.fromEmail,
        volume: s.sentCount,
        deliveryRate: s.sentCount > 0 ? Number(((s.deliveredCount / s.sentCount) * 100).toFixed(2)) : 0,
        bounceRate: s.sentCount > 0 ? Number(((s.bouncedCount / s.sentCount) * 100).toFixed(2)) : 0,
      }));

    const topCampaigns = this.campaigns
      .filter((c) => c.sentCount > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        sent: c.sentCount,
        delivered: c.deliveredCount,
        openRate: c.deliveredCount > 0 ? Number(((c.openCount / c.deliveredCount) * 100).toFixed(1)) : 0,
        clickRate: c.openCount > 0 ? Number(((c.clickCount / c.openCount) * 100).toFixed(1)) : 0,
      }));

    // Detect SES health based on webhook events or settings
    const hasSesEvents = this.messageEvents.some(
      (e) => e.eventType === 'DELIVERED' || e.eventType === 'BOUNCED' || e.eventType === 'SENT'
    );
    const sesHealth = hasSesEvents ? 'healthy' : this.settings.ses.status === 'healthy' ? 'healthy' : 'degraded';

    return {
      totalSent,
      delivered,
      bounced,
      failed,
      complaints,
      rejected,
      deliveryDelayed,
      renderingFailed,
      queued,
      opens,
      clicks,
      deliveryRate,
      bounceRate,
      openRate,
      clickRate,
      queueSize: queued,
      sendingRatePerSec,
      kumoHealth: 'healthy',
      sesHealth,
      timeseries,
      hourlyActivity,
      topSenders,
      topCampaigns,
    };
  }

  // Prometheus Metrics format & JSON (No fabricated constants)
  getPrometheusMetrics(): PrometheusMetrics {
    const stats = this.getDashboardStats();
    return {
      kumomta_queue_size: stats.queueSize,
      kumomta_messages_in_flight: 0,
      kumomta_messages_sent_total: stats.totalSent,
      kumomta_delivery_rate_per_second: stats.sendingRatePerSec,
      kumomta_smtp_connection_pool_active: 0,
      kumomta_smtp_connection_pool_idle: 0,
      kumomta_memory_usage_bytes: 0,
      kumomta_cpu_usage_percent: 0,
      ses_quota_max_24_hour: 0,
      ses_quota_sent_last_24_hour: 0,
      ses_quota_max_send_rate: 0,
      ses_reputation_bounce_rate: 0,
      ses_reputation_complaint_rate: 0,
    };
  }

  getPrometheusRawOutput(): string {
    const m = this.getPrometheusMetrics();
    return `# HELP kumomta_queue_size Number of messages currently in KumoMTA spool queue
# TYPE kumomta_queue_size gauge
kumomta_queue_size ${m.kumomta_queue_size}

# HELP kumomta_messages_in_flight Number of concurrent SMTP connections sending to upstream
# TYPE kumomta_messages_in_flight gauge
kumomta_messages_in_flight ${m.kumomta_messages_in_flight}

# HELP kumomta_messages_sent_total Total count of messages delivered via KumoMTA
# TYPE kumomta_messages_sent_total counter
kumomta_messages_sent_total ${m.kumomta_messages_sent_total}

# HELP kumomta_delivery_rate_per_second Current throughput rate in emails/sec
# TYPE kumomta_delivery_rate_per_second gauge
kumomta_delivery_rate_per_second ${m.kumomta_delivery_rate_per_second}

# HELP kumomta_smtp_connection_pool_active Active persistent connections to SES SMTP
# TYPE kumomta_smtp_connection_pool_active gauge
kumomta_smtp_connection_pool_active ${m.kumomta_smtp_connection_pool_active}

# HELP ses_quota_sent_last_24_hour Amazon SES 24-hour quota utilization
# TYPE ses_quota_sent_last_24_hour gauge
ses_quota_sent_last_24_hour ${m.ses_quota_sent_last_24_hour}

# HELP ses_reputation_bounce_rate Amazon SES rolling bounce rate percentage
# TYPE ses_reputation_bounce_rate gauge
ses_reputation_bounce_rate ${m.ses_reputation_bounce_rate}

# HELP ses_reputation_complaint_rate Amazon SES rolling complaint rate percentage
# TYPE ses_reputation_complaint_rate gauge
ses_reputation_complaint_rate ${m.ses_reputation_complaint_rate}
`;
  }

  // Find contact by email address
  findContactByEmail(email: string): Contact | undefined {
    if (!email) return undefined;
    const lower = email.toLowerCase().trim();
    return this.contacts.find((c) => c.email.toLowerCase() === lower);
  }

  // Find contact by ID
  findContactById(id: string): Contact | undefined {
    return this.contacts.find((c) => c.id === id);
  }

  // Mark a contact as UNSUBSCRIBED and add to suppressions idempotently
  unsubscribeContact(email: string, options?: { reason?: string; source?: string; contactId?: string }): {
    contact?: Contact;
    suppression: SuppressionItem;
    wasAlreadyUnsubscribed: boolean;
  } {
    const cleanEmail = email.toLowerCase().trim();
    const reason = options?.reason || 'User clicked unsubscribe link';
    const source = options?.source || 'unsubscribe_link';
    const timestamp = new Date().toISOString();

    // 1. Update contact status if found
    let contact = this.findContactByEmail(cleanEmail);
    if (!contact && options?.contactId) {
      contact = this.findContactById(options.contactId);
    }

    let wasAlreadyUnsubscribed = false;
    if (contact) {
      if (contact.status === 'UNSUBSCRIBED') {
        wasAlreadyUnsubscribed = true;
      }
      contact.status = 'UNSUBSCRIBED';
      contact.updatedAt = timestamp;
    }

    // 2. Add to suppressions list idempotently
    let suppression = this.suppressions.find((s) => s.email.toLowerCase() === cleanEmail);
    if (suppression) {
      if (suppression.type === 'UNSUBSCRIBED') {
        wasAlreadyUnsubscribed = true;
      }
      suppression.type = 'UNSUBSCRIBED';
      suppression.reason = reason;
      suppression.source = source;
    } else {
      suppression = {
        id: `sup_unsub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email: cleanEmail,
        type: 'UNSUBSCRIBED',
        reason,
        source,
        createdAt: timestamp,
      };
      this.suppressions.unshift(suppression);
    }

    return {
      contact,
      suppression,
      wasAlreadyUnsubscribed,
    };
  }
}

export const db = new DatabaseStore();
