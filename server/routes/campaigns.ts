import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { kumoMtaService } from '../services/KumoMtaService.js';

export const campaignsRouter = Router();

function clientOr503(req: Request, res: Response) {
  if (!req.user || !supabaseService.isConfigured || !supabaseService.getClient()) {
    res.status(503).json({ error: 'Authenticated Supabase persistence is required' });
    return null;
  }
  return supabaseService.getClient()!;
}

function mapCampaign(r: any) {
  return {
    id: r.id, name: r.name, senderId: r.sender_id, listId: r.list_id, templateId: r.template_id,
    subject: r.subject, preheader: r.preheader, headHtml: r.head_html, htmlBody: r.html_body, plainText: r.plain_text,
    status: r.status, scheduledAt: r.scheduled_at, startedAt: r.started_at, completedAt: r.completed_at,
    totalRecipients: r.total_recipients, sentCount: r.sent_count, deliveredCount: r.delivered_count,
    bouncedCount: r.bounced_count, complaintCount: r.complaint_count, openCount: r.open_count, clickCount: r.click_count,
    trackOpens: r.track_opens, trackClicks: r.track_clicks, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

campaignsRouter.get('/', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const { data, error } = await client.from('campaigns').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ campaigns: (data || []).map(mapCampaign) });
});

campaignsRouter.get('/:id', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const { data: row, error } = await client.from('campaigns').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!row) return res.status(404).json({ error: 'Campaign not found' });
  const { data: messages, error: msgError } = await client.from('messages').select('*').eq('campaign_id', row.id).eq('user_id', req.user!.id).order('created_at', { ascending: false }).limit(500);
  if (msgError) return res.status(400).json({ error: msgError.message });
  return res.json({ campaign: mapCampaign(row), messages: messages || [] });
});

campaignsRouter.post('/', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const { name, senderId, listId, templateId, subject, preheader, headHtml, htmlBody, plainText, scheduledAt, status, trackOpens, trackClicks, fromName, fromEmail, replyTo, customHeaders, isMarketing } = req.body;
  if (!name || !senderId || !subject) return res.status(400).json({ error: 'Name, sender, and subject are required' });

  const { data: sender, error: senderError } = await client.from('senders').select('*').eq('id', senderId).eq('user_id', req.user!.id).maybeSingle();
  if (senderError) return res.status(400).json({ error: senderError.message });
  if (!sender) return res.status(400).json({ error: 'Sender not found' });

  let list: any = null;
  if (listId) {
    const result = await client.from('contact_lists').select('*').eq('id', listId).eq('user_id', req.user!.id).maybeSingle();
    if (result.error) return res.status(400).json({ error: result.error.message });
    list = result.data;
    if (!list) return res.status(400).json({ error: 'Contact list not found' });
  }

  const payload = {
    user_id: req.user!.id, name: String(name).trim(), sender_id: sender.id, list_id: list?.id || null, template_id: templateId || null,
    subject: String(subject), preheader: preheader || null, head_html: headHtml || '', html_body: htmlBody || '', plain_text: plainText || null,
    status: status || 'DRAFT', scheduled_at: scheduledAt || null, total_recipients: list?.member_count || 0, sent_count: 0,
    delivered_count: 0, bounced_count: 0, complaint_count: 0, open_count: 0, click_count: 0,
    track_opens: trackOpens !== false, track_clicks: trackClicks !== false,
    from_name: fromName || sender.name, from_email: fromEmail || sender.from_email, reply_to: replyTo || sender.reply_to || null,
    custom_headers: customHeaders || null, is_marketing: isMarketing === true, unsubscribe_count: 0,
  };
  const { data, error } = await client.from('campaigns').insert(payload).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  await supabaseService.saveTechnicalLog({ id: `cmp_${data.id}`, timestamp: new Date().toISOString(), service: 'Application', event: 'CAMPAIGN_CREATED', severity: 'INFO', response: `Campaign ${data.name} created`, details: { campaignId: data.id } }, req.user!.id);
  return res.status(201).json({ success: true, campaign: mapCampaign(data) });
});

campaignsRouter.patch('/:id/status', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });
  const patch: any = { status, updated_at: new Date().toISOString() };
  if (status === 'SENDING') patch.started_at = new Date().toISOString();
  if (status === 'COMPLETED' || status === 'FAILED') patch.completed_at = new Date().toISOString();
  const { data, error } = await client.from('campaigns').update(patch).eq('id', req.params.id).eq('user_id', req.user!.id).select('*').maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Campaign not found' });
  return res.json({ success: true, campaign: mapCampaign(data) });
});

campaignsRouter.post('/:id/send', optionalAuth, async (req, res) => {
  const client = clientOr503(req, res); if (!client) return;
  const { data: campaign, error: campaignError } = await client.from('campaigns').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).maybeSingle();
  if (campaignError) return res.status(400).json({ error: campaignError.message });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status === 'SENDING') return res.status(409).json({ error: 'Campaign is already sending' });

  const { data: sender } = await client.from('senders').select('*').eq('id', campaign.sender_id).eq('user_id', req.user!.id).maybeSingle();
  if (!sender) return res.status(400).json({ error: 'Campaign sender is not available' });
  if (sender.status !== 'active' || sender.verification !== 'VERIFIED') return res.status(400).json({ error: 'Sender must be active and verified before sending' });

  let contacts: any[] = [];
  if (campaign.list_id) {
    const { data: members, error } = await client.from('contact_list_members').select('contact_id').eq('list_id', campaign.list_id);
    if (error) return res.status(400).json({ error: error.message });
    const ids = (members || []).map((m: any) => m.contact_id);
    if (ids.length) {
      const result = await client.from('contacts').select('*').eq('user_id', req.user!.id).in('id', ids);
      if (result.error) return res.status(400).json({ error: result.error.message });
      contacts = result.data || [];
    }
  } else {
    const result = await client.from('contacts').select('*').eq('user_id', req.user!.id);
    if (result.error) return res.status(400).json({ error: result.error.message });
    contacts = result.data || [];
  }

  const { data: suppressions } = await client.from('suppressions').select('email').eq('user_id', req.user!.id);
  const suppressed = new Set((suppressions || []).map((s: any) => String(s.email).toLowerCase()));
  contacts = contacts.filter((c: any) => c.status === 'ACTIVE' && !suppressed.has(String(c.email).toLowerCase()));

  await client.from('campaigns').update({ status: 'SENDING', started_at: new Date().toISOString(), total_recipients: contacts.length, updated_at: new Date().toISOString() }).eq('id', campaign.id).eq('user_id', req.user!.id);

  const baseUrl = personalizationService.getBaseUrl(req.get('host'));
  const senderDomain = String(sender.from_email).split('@')[1] || '';
  const results: any[] = [];
  let sentCount = 0, failedCount = 0;

  for (const contact of contacts) {
    const recipientEmail = String(contact.email).trim().toLowerCase();
    try {
      const internalId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const { unsubscribeUrl } = await personalizationService.generateUnsubscribeToken({ email: recipientEmail, contactId: contact.id, messageId: internalId, campaignId: campaign.id, userId: req.user!.id, baseUrl });
      let html = personalizationService.personalizeContent(campaign.html_body || '', { contact: { id: contact.id, email: contact.email, firstName: contact.first_name, lastName: contact.last_name, company: contact.company, tags: contact.tags || [], status: contact.status, createdAt: contact.created_at, updatedAt: contact.updated_at }, email: recipientEmail, unsubscribeUrl });
      const subject = personalizationService.personalizeContent(campaign.subject, { contact: { id: contact.id, email: contact.email, firstName: contact.first_name, lastName: contact.last_name, company: contact.company, tags: contact.tags || [], status: contact.status, createdAt: contact.created_at, updatedAt: contact.updated_at }, email: recipientEmail, unsubscribeUrl });
      if (campaign.track_clicks) html = personalizationService.rewriteLinksForClickTracking(html, internalId, baseUrl);
      if (campaign.track_opens) html = personalizationService.injectOpenTrackingPixel(html, internalId, baseUrl);
      const headers = { ...((campaign.custom_headers || {}) as Record<string, string>), ...personalizationService.generateUnsubscribeHeaders(unsubscribeUrl, senderDomain) };
      await kumoMtaService.submitEmail({ internalId, contactId: contact.id, fromName: campaign.from_name || sender.name, fromEmail: campaign.from_email || sender.from_email, replyTo: campaign.reply_to || sender.reply_to, to: recipientEmail, subject, htmlBody: html, plainText: campaign.plain_text || undefined, customHeaders: headers, campaignId: campaign.id, userId: req.user!.id });
      await client.from('campaign_recipients').upsert({ campaign_id: campaign.id, contact_id: contact.id, email: recipientEmail, message_id: internalId, status: 'SENT', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'campaign_id,email' });
      sentCount++; results.push({ email: recipientEmail, status: 'SENT', messageId: internalId });
    } catch (err: any) {
      failedCount++; results.push({ email: recipientEmail, status: 'FAILED', reason: err?.message || String(err) });
    }
  }

  const finalStatus = failedCount && !sentCount ? 'FAILED' : 'COMPLETED';
  const { data: finalCampaign } = await client.from('campaigns').update({ status: finalStatus, sent_count: sentCount, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', campaign.id).eq('user_id', req.user!.id).select('*').single();
  await supabaseService.saveTechnicalLog({ id: `cmp_send_${campaign.id}_${Date.now()}`, timestamp: new Date().toISOString(), service: 'Application', event: 'CAMPAIGN_DISPATCH_COMPLETED', severity: failedCount ? 'WARN' : 'INFO', response: `${sentCount} sent, ${failedCount} failed`, details: { campaignId: campaign.id, sentCount, failedCount, recipientCount: contacts.length } }, req.user!.id);

  return res.json({ success: true, campaign: mapCampaign(finalCampaign || { ...campaign, status: finalStatus, sent_count: sentCount }), summary: { totalCandidates: contacts.length, sentCount, suppressedCount: 0, failedCount }, results });
});
