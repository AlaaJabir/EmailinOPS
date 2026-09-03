import { Router, Request, Response } from 'express';
import { db } from '../store.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { supabaseService } from '../services/SupabaseService.js';
import { eventProcessor } from '../services/EventProcessor.js';

export const unsubscribeRouter = Router();

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.max(3, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

function renderConfirmationHtml(email: string): string {
  const masked = maskEmail(email);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed | EmailOps</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #050505;
      color: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #0f0f0f;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10b981;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 14px;
      color: #a1a1aa;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .email-chip {
      display: inline-block;
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 6px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      color: #38bdf8;
      margin-bottom: 24px;
    }
    .footer {
      font-size: 12px;
      color: #71717a;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    </div>
    <h1>You have been unsubscribed successfully.</h1>
    <p>Your request has been processed. You will no longer receive broadcast or marketing campaigns from this list.</p>
    <div class="email-chip">${masked}</div>
    <div class="footer">
      EmailOps Deliverability &bull; RFC 8058 Opt-Out Compliance
    </div>
  </div>
</body>
</html>`;
}

function renderErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe | EmailOps</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #050505;
      color: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #0f0f0f;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 18px; color: #ef4444; margin-bottom: 12px; }
    p { font-size: 14px; color: #a1a1aa; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unable to Process Unsubscribe</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

/**
 * Handle unsubscribe logic idempotently
 */
async function processUnsubscribe(tokenStr: string, req: Request) {
  const token = await personalizationService.findToken(tokenStr);
  if (!token) {
    return { success: false, error: 'Invalid or expired unsubscribe token' };
  }

  const email = token.email;

  // 1. Mark in in-memory store and suppression list
  const result = db.unsubscribeContact(email, {
    reason: 'User clicked unsubscribe link',
    source: 'unsubscribe_link',
    contactId: token.contactId,
  });

  token.unsubscribedAt = new Date().toISOString();

  // 2. Persist to Supabase if configured
  await supabaseService.markContactUnsubscribed(email, token.userId);
  await supabaseService.addSuppression({
    email,
    type: 'UNSUBSCRIBED',
    reason: 'User clicked unsubscribe link',
    source: 'unsubscribe_link',
    userId: token.userId,
  });

  // 3. Record event if messageId exists
  if (token.messageId) {
    eventProcessor.processEvent({
      messageId: token.messageId,
      eventType: 'UNSUBSCRIBED',
      eventData: {
        token: tokenStr,
        email,
        campaignId: token.campaignId,
        source: req.method === 'POST' ? 'one_click_post' : 'browser_get',
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  // 4. Log technical event
  db.logs.unshift({
    id: `log_unsub_${Date.now()}`,
    timestamp: new Date().toISOString(),
    service: 'Application',
    messageId: token.messageId,
    event: 'RECIPIENT_UNSUBSCRIBED',
    severity: 'INFO',
    response: `Recipient ${email} marked as UNSUBSCRIBED (Idempotent: ${result.wasAlreadyUnsubscribed})`,
    details: {
      email,
      token: tokenStr,
      contactId: token.contactId,
      campaignId: token.campaignId,
      ip: req.ip,
    },
  });

  return {
    success: true,
    email,
    wasAlreadyUnsubscribed: result.wasAlreadyUnsubscribed,
  };
}

/**
 * GET /unsubscribe/:token
 * Standard recipient browser click
 */
unsubscribeRouter.get('/:token', async (req: Request, res: Response) => {
  const tokenStr = req.params.token;
  const outcome = await processUnsubscribe(tokenStr, req);

  if (!outcome.success || !outcome.email) {
    return res.status(404).send(renderErrorHtml(outcome.error || 'The unsubscribe link could not be verified.'));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderConfirmationHtml(outcome.email));
});

/**
 * POST /unsubscribe/:token
 * RFC 8058 One-Click Unsubscribe (sent by MUA e.g. Gmail / Yahoo with body 'List-Unsubscribe=One-Click')
 */
unsubscribeRouter.post('/:token', async (req: Request, res: Response) => {
  const tokenStr = req.params.token;
  const outcome = await processUnsubscribe(tokenStr, req);

  if (!outcome.success) {
    return res.status(400).json({ error: outcome.error });
  }

  // RFC 8058 expects 200 OK
  res.status(200).json({
    success: true,
    message: 'You have been unsubscribed successfully.',
    email: outcome.email,
    idempotent: outcome.wasAlreadyUnsubscribed,
  });
});
