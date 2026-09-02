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
} from '../src/types.js';

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
  logs: TechnicalLog[] = [];
  settings: Record<string, any> = {};
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt?: string }> = [];

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

    // 3. Senders
    this.senders = [
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
        sentCount: 42890,
        deliveredCount: 42680,
        bouncedCount: 180,
        complaintCount: 30,
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
        sentCount: 88400,
        deliveredCount: 86950,
        bouncedCount: 1320,
        complaintCount: 130,
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
        sentCount: 14200,
        deliveredCount: 14050,
        bouncedCount: 140,
        complaintCount: 10,
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

    // 8. Campaigns
    this.campaigns = [
      {
        id: 'cmp_01',
        name: 'KumoMTA 3.0 Platform Upgrade Announcement',
        senderId: 'snd_02',
        senderName: 'Acme Product Announcements',
        fromEmail: 'news@marketing.acme-corp.io',
        listId: 'lst_03',
        listName: 'Monthly Tech Digest',
        templateId: 'tmpl_02',
        subject: '🚀 Introducing KumoMTA 3.0 High-Throughput Queue Management',
        htmlBody: this.templates[1].htmlBody,
        plainText: this.templates[1].plainText,
        status: 'COMPLETED',
        scheduledAt: iso(1440),
        startedAt: iso(1430),
        completedAt: iso(1380),
        totalRecipients: 12400,
        sentCount: 12400,
        deliveredCount: 12210,
        bouncedCount: 168,
        complaintCount: 22,
        openCount: 5490,
        clickCount: 1820,
        createdAt: iso(2880),
      },
      {
        id: 'cmp_02',
        name: 'Quarterly Security Hygiene & DMARC Mandate Notice',
        senderId: 'snd_01',
        senderName: 'Acme Auth & Security',
        fromEmail: 'security@transact.acme-corp.io',
        listId: 'lst_01',
        listName: 'Enterprise VIP Customers',
        subject: 'Action Required: 2026 DMARC & BIMI Enforcement Guidelines',
        htmlBody: '<p>Important security compliance memo regarding DKIM/SPF alignment on all upstream SES endpoints.</p>',
        plainText: 'Important security compliance memo regarding DKIM/SPF alignment.',
        status: 'COMPLETED',
        scheduledAt: iso(720),
        startedAt: iso(710),
        completedAt: iso(690),
        totalRecipients: 1850,
        sentCount: 1850,
        deliveredCount: 1846,
        bouncedCount: 4,
        complaintCount: 0,
        openCount: 1420,
        clickCount: 680,
        createdAt: iso(1200),
      },
      {
        id: 'cmp_03',
        name: 'Beta Cluster Migration: Europe-West Routing',
        senderId: 'snd_03',
        senderName: 'Acme Cloud Alerts',
        fromEmail: 'alerts@notifications.acme-cloud.net',
        listId: 'lst_02',
        listName: 'Beta Program Subscribers',
        subject: 'Notice: Scheduled maintenance on KumoMTA Spool Cluster B',
        htmlBody: '<p>Scheduled maintenance window for internal queue spool re-balancing.</p>',
        status: 'SENDING',
        scheduledAt: iso(30),
        startedAt: iso(25),
        totalRecipients: 4200,
        sentCount: 2890,
        deliveredCount: 2840,
        bouncedCount: 38,
        complaintCount: 2,
        openCount: 940,
        clickCount: 210,
        createdAt: iso(180),
      },
    ];

    // 9. Messages (Detailed records with RFC Message-IDs and event chains)
    const sampleRecipients = [
      { email: 'alexander.wright@fintech-vault.co.uk', subject: 'Your Acme Security Verification Code: 849-201', senderId: 'snd_01', status: 'DELIVERED', mins: 4 },
      { email: 'sarah.connor@cyberdyne-defense.org', subject: 'Your Acme Security Verification Code: 312-909', senderId: 'snd_01', status: 'DELIVERED', mins: 8 },
      { email: 'kevin.mitnick@infosec-labs.io', subject: 'Notice: Scheduled maintenance on KumoMTA Spool Cluster B', senderId: 'snd_03', status: 'SENDING', mins: 12 },
      { email: 'bounced.recipient.deadbox@invalid-domain-test.com', subject: '🚀 Introducing KumoMTA 3.0 High-Throughput Queue Management', senderId: 'snd_02', status: 'BOUNCED', mins: 15, bounceType: 'Hard', bounceReason: '550 5.1.1 Host lookup failed: Recipient domain MX does not exist' },
      { email: 'spam-trap@disposable-mail-honeypot.org', subject: '🚀 Introducing KumoMTA 3.0 High-Throughput Queue Management', senderId: 'snd_02', status: 'COMPLAINED', mins: 22 },
      { email: 'michelle.yeoh@hollywood-prod.net', subject: 'Action Required: 2026 DMARC & BIMI Enforcement Guidelines', senderId: 'snd_01', status: 'DELIVERED', mins: 35 },
      { email: 'johannes.kepler@astronomy-data.de', subject: '🚀 Introducing KumoMTA 3.0 High-Throughput Queue Management', senderId: 'snd_02', status: 'DELIVERED', mins: 42 },
      { email: 'alan.turing@bletchley-math.ac.uk', subject: 'Your Acme Security Verification Code: 994-012', senderId: 'snd_01', status: 'DELIVERED', mins: 55 },
      { email: 'ada.lovelace@analytical-engines.com', subject: 'Action Required: 2026 DMARC & BIMI Enforcement Guidelines', senderId: 'snd_01', status: 'DELIVERED', mins: 75 },
      { email: 'grace.hopper@nanoseconds.navy.mil', subject: 'Your Acme Security Verification Code: 620-117', senderId: 'snd_01', status: 'DELIVERED', mins: 90 },
      { email: 'dennis.ritchie@bell-labs-unix.org', subject: 'Notice: Scheduled maintenance on KumoMTA Spool Cluster B', senderId: 'snd_03', status: 'SENT', mins: 110 },
      { email: 'ken.thompson@plan9-os.net', subject: 'Notice: Scheduled maintenance on KumoMTA Spool Cluster B', senderId: 'snd_03', status: 'QUEUED', mins: 120 },
      { email: 'tim.berners@w3c-hypertext.org', subject: 'Action Required: 2026 DMARC & BIMI Enforcement Guidelines', senderId: 'snd_01', status: 'DELIVERED', mins: 150 },
      { email: 'linus.torvalds@kernel-maintainers.org', subject: '🚀 Introducing KumoMTA 3.0 High-Throughput Queue Management', senderId: 'snd_02', status: 'DELIVERED', mins: 180 },
      { email: 'failed.mailbox.quota@full-storage.edu', subject: '🚀 Introducing KumoMTA 3.0 High-Throughput Queue Management', senderId: 'snd_02', status: 'FAILED', mins: 210, bounceType: 'Soft', bounceReason: '452 4.2.2 Mailbox is full / Over storage quota' },
    ];

    this.messages = sampleRecipients.map((item, idx) => {
      const sender = this.senders.find((s) => s.id === item.senderId) || this.senders[0];
      const domain = this.domains.find((d) => d.id === sender.domainId)?.domainName || 'transact.acme-corp.io';
      const msgUniqueId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const rfcMessageId = `<${Math.random().toString(36).substring(2, 12)}.${Date.now() - item.mins * 60000}@${domain}>`;
      const providerMsgId = `ses-${Math.random().toString(36).substring(2, 14)}-eu-west-1`;

      const msgObj: Message = {
        id: msgUniqueId,
        messageId: rfcMessageId,
        campaignId: item.senderId === 'snd_02' ? 'cmp_01' : item.senderId === 'snd_03' ? 'cmp_03' : 'cmp_02',
        campaignName: item.senderId === 'snd_02' ? 'KumoMTA 3.0 Announcement' : item.senderId === 'snd_03' ? 'Beta Cluster Maintenance' : 'DMARC Security Notice',
        senderId: sender.id,
        fromName: sender.name,
        fromEmail: sender.fromEmail,
        toEmail: item.email,
        replyTo: sender.replyTo,
        subject: item.subject,
        htmlBody: '<div style="font-family:sans-serif;"><h3>Email Content</h3><p>Message delivered through KumoMTA spool and SES relay.</p></div>',
        plainText: 'Email Content - Message delivered through KumoMTA spool and SES relay.',
        customHeaders: {
          'X-KumoMTA-Queue': 'tier1-high-throughput',
          'X-SES-Configuration-Set': 'EmailOps-Production-ConfigSet',
          'List-Unsubscribe': `<mailto:unsub@${domain}?subject=unsub>, <https://${domain}/u/${msgUniqueId}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'Feedback-ID': `ops-campaign:${sender.id}:emailops`,
        },
        status: item.status as any,
        provider: 'KumoMTA + Amazon SES',
        providerMessageId: providerMsgId,
        smtpResponse: item.status === 'DELIVERED'
          ? '250 2.0.0 OK: 1712903429 s3_msg_delivery_ack'
          : item.status === 'BOUNCED' || item.status === 'FAILED'
          ? item.bounceReason
          : '250 2.1.5 Recipient queued in KumoMTA spool',
        bounceType: (item.bounceType as any) || undefined,
        bounceReason: item.bounceReason || undefined,
        queuedAt: iso(item.mins + 1),
        sentAt: item.status !== 'QUEUED' ? iso(item.mins) : undefined,
        deliveredAt: item.status === 'DELIVERED' ? iso(item.mins - 0.2) : undefined,
        bouncedAt: item.status === 'BOUNCED' ? iso(item.mins - 0.1) : undefined,
        createdAt: iso(item.mins + 1),
      };

      // Generate Events
      const events: MessageEvent[] = [
        {
          id: `evt_q_${idx}`,
          messageId: rfcMessageId,
          eventType: 'QUEUED',
          eventData: { queue: 'tier1-high-throughput', host: 'kumomta-spool-01.internal' },
          timestamp: iso(item.mins + 1),
        },
      ];

      if (item.status !== 'QUEUED') {
        events.push({
          id: `evt_s_${idx}`,
          messageId: rfcMessageId,
          eventType: 'SENDING',
          eventData: { relay: 'email-smtp.eu-west-1.amazonaws.com:587', tls: 'TLSv1.3' },
          timestamp: iso(item.mins + 0.5),
        });
        events.push({
          id: `evt_sent_${idx}`,
          messageId: rfcMessageId,
          eventType: 'SENT',
          eventData: { providerMessageId: providerMsgId },
          timestamp: iso(item.mins),
        });
      }

      if (item.status === 'DELIVERED') {
        events.push({
          id: `evt_del_${idx}`,
          messageId: rfcMessageId,
          eventType: 'DELIVERED',
          eventData: { smtpCode: 250, latencyMs: 340 },
          timestamp: iso(item.mins - 0.2),
        });
        // Add open and clicks to some
        if (idx % 2 === 0) {
          events.push({
            id: `evt_op_${idx}`,
            messageId: rfcMessageId,
            eventType: 'OPENED',
            eventData: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
            timestamp: iso(item.mins - 1),
            ipAddress: '54.210.12.88',
            geo: 'London, United Kingdom',
          });
        }
        if (idx % 3 === 0) {
          events.push({
            id: `evt_cl_${idx}`,
            messageId: rfcMessageId,
            eventType: 'CLICKED',
            eventData: { targetUrl: 'https://acme-corp.io/release-3' },
            timestamp: iso(item.mins - 1.5),
            ipAddress: '54.210.12.88',
            geo: 'London, United Kingdom',
          });
        }
      } else if (item.status === 'BOUNCED') {
        events.push({
          id: `evt_bnc_${idx}`,
          messageId: rfcMessageId,
          eventType: 'BOUNCED',
          eventData: { reason: item.bounceReason, type: item.bounceType },
          timestamp: iso(item.mins - 0.1),
        });
      } else if (item.status === 'COMPLAINED') {
        events.push({
          id: `evt_cmp_${idx}`,
          messageId: rfcMessageId,
          eventType: 'COMPLAINED',
          eventData: { feedbackType: 'abuse', userAgent: 'Yahoo Mail Web' },
          timestamp: iso(item.mins - 0.1),
        });
      }

      msgObj.events = events;
      this.messageEvents.push(...events);
      return msgObj;
    });

    // 10. Technical Logs
    this.logs = [
      {
        id: 'log_01',
        timestamp: iso(1),
        service: 'KumoMTA',
        messageId: this.messages[0]?.messageId,
        event: 'SPOOL_INJECT_SUCCESS',
        severity: 'INFO',
        response: 'Accepted RFC 5322 payload. Enqueued to tier1-high-throughput with priority 10.',
        details: { connection: '127.0.0.1:25', cipher: 'ECDHE-RSA-AES128-GCM-SHA256' },
      },
      {
        id: 'log_02',
        timestamp: iso(2),
        service: 'Amazon SES',
        messageId: this.messages[0]?.messageId,
        event: 'UPSTREAM_DELIVERY_250',
        severity: 'SUCCESS',
        response: '250 2.0.0 OK: queued as ses-098f6bcd4621d373cade4e832627b4f6',
        details: { endpoint: 'email-smtp.eu-west-1.amazonaws.com:587', rttMs: 182 },
      },
      {
        id: 'log_03',
        timestamp: iso(5),
        service: 'Webhook Processor',
        messageId: this.messages[3]?.messageId,
        event: 'SES_BOUNCE_NOTIFICATION',
        severity: 'WARN',
        response: 'SNS MessageId: a4b1c2d3-98fe. Action: Recipient added to permanent Suppression list.',
        details: { bounceType: 'Permanent', subType: 'General' },
      },
      {
        id: 'log_04',
        timestamp: iso(10),
        service: 'Tracking',
        messageId: this.messages[6]?.messageId,
        event: 'OPEN_PIXEL_HIT',
        severity: 'INFO',
        response: 'Pixel 1x1 GET /track/open?id=msg_... UserAgent: Apple Mail/16.0 (macOS)',
        details: { ip: '185.122.40.12', country: 'DE' },
      },
      {
        id: 'log_05',
        timestamp: iso(15),
        service: 'Application',
        event: 'COMPLIANCE_AUDIT',
        severity: 'INFO',
        response: 'Suppression pre-flight validation passed for campaign cmp_01 (12,400 clean recipients).',
      },
      {
        id: 'log_06',
        timestamp: iso(20),
        service: 'KumoMTA',
        event: 'CONNECTION_POOL_REBALANCE',
        severity: 'INFO',
        response: 'KumoMTA dynamic pool rebalanced: 32 active TCP channels to SES upstream.',
      },
      {
        id: 'log_07',
        timestamp: iso(30),
        service: 'Amazon SES',
        event: 'REPUTATION_METRICS_SYNC',
        severity: 'INFO',
        response: 'SES Account Status: Healthy. Bounce Rate: 0.14% (Threshold: <5%), Complaint Rate: 0.02% (Threshold: <0.1%).',
      },
    ];

    // 11. API Keys
    this.apiKeys = [
      {
        id: 'key_01',
        name: 'KumoMTA Automation Pipeline Key',
        keyPrefix: 'em_live_9f823...',
        createdAt: iso(7200),
        lastUsedAt: iso(2),
      },
      {
        id: 'key_02',
        name: 'CI/CD Transactional Staging Key',
        keyPrefix: 'em_test_a17c2...',
        createdAt: iso(3600),
        lastUsedAt: iso(180),
      },
    ];

    // 12. Settings
    this.settings = {
      kumomta: {
        host: '127.0.0.1',
        port: 25,
        apiUrl: 'http://127.0.0.1:8000',
        username: 'kumomta_admin',
        spoolPath: '/var/spool/kumomta',
        maxConcurrency: 64,
        maxRetries: 5,
        retryIntervalSec: 300,
        status: 'healthy',
      },
      ses: {
        smtpHost: 'email-smtp.eu-west-1.amazonaws.com',
        smtpPort: 587,
        username: 'AKIAIOSFODNN7EXAMPLE',
        region: 'eu-west-1',
        configurationSet: 'EmailOps-Production-ConfigSet',
        snsBounceTopic: 'arn:aws:sns:eu-west-1:255336227693:EmailOps-SES-Bounces',
        snsComplaintTopic: 'arn:aws:sns:eu-west-1:255336227693:EmailOps-SES-Complaints',
        status: 'healthy',
      },
      tracking: {
        enableOpenTracking: true,
        enableClickTracking: true,
        trackingDomain: 'track.transact.acme-corp.io',
        customHeaders: {
          'X-Entity-ID': 'emailops-cluster-01',
          'X-Compliant-Sending': 'true',
        },
      },
      compliance: {
        enforceUnsubscribeHeader: true,
        autoSuppressHardBounces: true,
        autoSuppressComplaints: true,
        physicalPostalAddress: 'Acme Corp, 500 Cloud Parkway, Tech District, CA 94105',
      },
      prometheus: {
        enabled: true,
        scrapePath: '/api/metrics',
        scrapeIntervalSec: 15,
        lastScrapeTime: new Date().toISOString(),
      },
    };
  }

  // Dashboard Aggregations
  getDashboardStats() {
    const totalSent = this.senders.reduce((acc, s) => acc + s.sentCount, 0);
    const delivered = this.senders.reduce((acc, s) => acc + s.deliveredCount, 0);
    const bounced = this.senders.reduce((acc, s) => acc + s.bouncedCount, 0);
    const complaints = this.senders.reduce((acc, s) => acc + s.complaintCount, 0);
    const failed = 240;
    const opens = 68400;
    const clicks = 23900;

    const deliveryRate = totalSent > 0 ? Number(((delivered / totalSent) * 100).toFixed(2)) : 0;
    const bounceRate = totalSent > 0 ? Number(((bounced / totalSent) * 100).toFixed(2)) : 0;
    const openRate = delivered > 0 ? Number(((opens / delivered) * 100).toFixed(2)) : 0;
    const clickRate = opens > 0 ? Number(((clicks / opens) * 100).toFixed(2)) : 0;

    // Time-series (last 7 days or points)
    const timeseries = [
      { time: 'Mon', sent: 18400, delivered: 18210, bounced: 140, failed: 50 },
      { time: 'Tue', sent: 22100, delivered: 21890, bounced: 160, failed: 50 },
      { time: 'Wed', sent: 24500, delivered: 24200, bounced: 210, failed: 90 },
      { time: 'Thu', sent: 19800, delivered: 19610, bounced: 150, failed: 40 },
      { time: 'Fri', sent: 28900, delivered: 28550, bounced: 270, failed: 80 },
      { time: 'Sat', sent: 14200, delivered: 14080, bounced: 95, failed: 25 },
      { time: 'Sun', sent: 17590, delivered: 17440, bounced: 115, failed: 35 },
    ];

    // Hourly sending volume distribution
    const hourlyActivity = [
      { hour: '00:00', volume: 620 },
      { hour: '02:00', volume: 410 },
      { hour: '04:00', volume: 380 },
      { hour: '06:00', volume: 1450 },
      { hour: '08:00', volume: 4890 },
      { hour: '10:00', volume: 7420 },
      { hour: '12:00', volume: 6900 },
      { hour: '14:00', volume: 8150 },
      { hour: '16:00', volume: 6300 },
      { hour: '18:00', volume: 4120 },
      { hour: '20:00', volume: 2450 },
      { hour: '22:00', volume: 1100 },
    ];

    const topSenders = this.senders.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.fromEmail,
      volume: s.sentCount,
      deliveryRate: s.sentCount > 0 ? Number(((s.deliveredCount / s.sentCount) * 100).toFixed(2)) : 0,
      bounceRate: s.sentCount > 0 ? Number(((s.bouncedCount / s.sentCount) * 100).toFixed(2)) : 0,
    }));

    const topCampaigns = this.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      sent: c.sentCount,
      delivered: c.deliveredCount,
      openRate: c.deliveredCount > 0 ? Number(((c.openCount / c.deliveredCount) * 100).toFixed(1)) : 0,
      clickRate: c.openCount > 0 ? Number(((c.clickCount / c.openCount) * 100).toFixed(1)) : 0,
    }));

    return {
      totalSent,
      delivered,
      bounced,
      failed,
      complaints,
      opens,
      clicks,
      deliveryRate,
      bounceRate,
      openRate,
      clickRate,
      queueSize: 14,
      sendingRatePerSec: 142.6,
      kumoHealth: 'healthy',
      sesHealth: 'healthy',
      timeseries,
      hourlyActivity,
      topSenders,
      topCampaigns,
    };
  }

  // Prometheus Metrics format & JSON
  getPrometheusMetrics(): PrometheusMetrics {
    return {
      kumomta_queue_size: 14,
      kumomta_messages_in_flight: 8,
      kumomta_messages_sent_total: this.messages.length + 145490,
      kumomta_delivery_rate_per_second: 142.6,
      kumomta_smtp_connection_pool_active: 32,
      kumomta_smtp_connection_pool_idle: 16,
      kumomta_memory_usage_bytes: 536870912, // 512 MB
      kumomta_cpu_usage_percent: 18.4,
      ses_quota_max_24_hour: 500000,
      ses_quota_sent_last_24_hour: 145490,
      ses_quota_max_send_rate: 200,
      ses_reputation_bounce_rate: 0.14,
      ses_reputation_complaint_rate: 0.02,
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
}

export const db = new DatabaseStore();
