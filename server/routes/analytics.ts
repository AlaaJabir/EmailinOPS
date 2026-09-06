import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';

export const analyticsRouter = Router();

analyticsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user || !supabaseService.isConfigured || !supabaseService.getClient()) return res.status(401).json({ error: 'Authentication required' });
  const client = supabaseService.getClient()!;
  const { dateRange = '7d', senderId, campaignId, domain } = req.query;
  const days = dateRange === '24h' ? 1 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let messageQuery = client.from('messages').select('id,internal_id,message_id,from_email,to_email,sender_id,campaign_id,status,created_at,delivered_at,bounced_at').eq('user_id', req.user.id).gte('created_at', since);
  if (senderId && typeof senderId === 'string') messageQuery = messageQuery.eq('sender_id', senderId);
  if (campaignId && typeof campaignId === 'string') messageQuery = messageQuery.eq('campaign_id', campaignId);
  const { data: messages, error: messageError } = await messageQuery;
  if (messageError) return res.status(400).json({ error: messageError.message });
  const rows = messages || [];
  const filtered = domain && typeof domain === 'string' ? rows.filter((m: any) => String(m.to_email).split('@')[1]?.toLowerCase() === domain.toLowerCase()) : rows;
  const messageIds = filtered.map((m: any) => m.message_id).filter(Boolean);
  let events: any[] = [];
  if (messageIds.length) {
    const { data, error } = await client.from('message_events').select('message_id,event_type,timestamp').eq('user_id', req.user.id).in('message_id', messageIds).gte('timestamp', since);
    if (error) return res.status(400).json({ error: error.message });
    events = data || [];
  }
  const count = (type: string) => events.filter((e) => e.event_type === type).length;
  const unique = (type: string) => new Set(events.filter((e) => e.event_type === type).map((e) => e.message_id)).size;
  const totalSent = filtered.length;
  const delivered = filtered.filter((m: any) => m.status === 'DELIVERED' || m.delivered_at).length;
  const bounced = filtered.filter((m: any) => m.status === 'BOUNCED' || m.bounced_at).length;
  const failed = filtered.filter((m: any) => m.status === 'FAILED').length;
  const complaints = count('COMPLAINED');
  const opens = count('OPENED');
  const clicks = count('CLICKED');
  const uniqueOpens = unique('OPENED');
  const uniqueClicks = unique('CLICKED');
  const deliveryRate = totalSent ? delivered / totalSent * 100 : 0;
  const bounceRate = totalSent ? bounced / totalSent * 100 : 0;
  const openRate = delivered ? uniqueOpens / delivered * 100 : 0;
  const clickRate = delivered ? uniqueClicks / delivered * 100 : 0;

  const daily = new Map<string, any>();
  for (let i = 0; i < days; i++) { const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0,10); daily.set(d, { date: d, sent: 0, delivered: 0, bounced: 0, opens: 0, clicks: 0 }); }
  for (const m of filtered) { const d = String(m.created_at).slice(0,10); if (daily.has(d)) daily.get(d).sent++; if (m.status === 'DELIVERED' || m.delivered_at) if (daily.has(d)) daily.get(d).delivered++; if (m.status === 'BOUNCED' || m.bounced_at) if (daily.has(d)) daily.get(d).bounced++; }
  for (const e of events) { const d = String(e.timestamp).slice(0,10); if (!daily.has(d)) continue; if (e.event_type === 'OPENED') daily.get(d).opens++; if (e.event_type === 'CLICKED') daily.get(d).clicks++; }

  const domains = new Map<string, any>();
  for (const m of filtered) { const d = String(m.to_email).split('@')[1]?.toLowerCase() || 'unknown'; const x = domains.get(d) || { domain:d, volume:0, delivered:0, bounced:0, openRate:0, clickRate:0 }; x.volume++; if (m.status === 'DELIVERED' || m.delivered_at) x.delivered++; if (m.status === 'BOUNCED' || m.bounced_at) x.bounced++; domains.set(d,x); }
  for (const [d,x] of domains) { const ids = new Set(filtered.filter((m:any)=>String(m.to_email).split('@')[1]?.toLowerCase()===d).map((m:any)=>m.message_id)); x.openRate = x.delivered ? Number((events.filter(e=>e.event_type==='OPENED' && ids.has(e.message_id)).length / x.delivered * 100).toFixed(2)) : 0; x.clickRate = x.delivered ? Number((events.filter(e=>e.event_type==='CLICKED' && ids.has(e.message_id)).length / x.delivered * 100).toFixed(2)) : 0; }

  const senderIds = [...new Set(filtered.map((m:any)=>m.sender_id).filter(Boolean))];
  let senders:any[]=[]; if(senderIds.length){ const r=await client.from('senders').select('id,name,from_email').eq('user_id',req.user.id).in('id',senderIds); senders=r.data||[]; }
  const senderComparison=senders.map((s:any)=>{const ms=filtered.filter((m:any)=>m.sender_id===s.id);const t=ms.length||1;return{id:s.id,name:s.name,email:s.from_email,sent:ms.length,delivered:ms.filter((m:any)=>m.status==='DELIVERED'||m.delivered_at).length,bounced:ms.filter((m:any)=>m.status==='BOUNCED'||m.bounced_at).length,complaints:events.filter(e=>e.event_type==='COMPLAINED'&&ms.some((m:any)=>m.message_id===e.message_id)).length,deliveryRate:Number((ms.filter((m:any)=>m.status==='DELIVERED'||m.delivered_at).length/t*100).toFixed(2)),bounceRate:Number((ms.filter((m:any)=>m.status==='BOUNCED'||m.bounced_at).length/t*100).toFixed(2))};});

  const campaignIds=[...new Set(filtered.map((m:any)=>m.campaign_id).filter(Boolean))]; let campaigns:any[]=[]; if(campaignIds.length){const r=await client.from('campaigns').select('id,name,status,sender_id').eq('user_id',req.user.id).in('id',campaignIds);campaigns=r.data||[];}
  const campaignComparison=campaigns.map((c:any)=>{const ms=filtered.filter((m:any)=>m.campaign_id===c.id);const ids=new Set(ms.map((m:any)=>m.message_id));const del=ms.filter((m:any)=>m.status==='DELIVERED'||m.delivered_at).length;const op=events.filter(e=>e.event_type==='OPENED'&&ids.has(e.message_id)).length;const cl=events.filter(e=>e.event_type==='CLICKED'&&ids.has(e.message_id)).length;return{id:c.id,name:c.name,sender:c.sender_id,status:c.status,sent:ms.length,delivered:del,bounced:ms.filter((m:any)=>m.status==='BOUNCED'||m.bounced_at).length,opens:op,clicks:cl,deliveryRate:Number((del/(ms.length||1)*100).toFixed(1)),openRate:Number((op/(del||1)*100).toFixed(1)),clickRate:Number((cl/(op||1)*100).toFixed(1))};});

  return res.json({ kpis:{totalSent,delivered,bounced,failed,complaints,opens,clicks,uniqueOpens,uniqueClicks,deliveryRate:Number(deliveryRate.toFixed(2)),bounceRate:Number(bounceRate.toFixed(2)),openRate:Number(openRate.toFixed(2)),clickRate:Number(clickRate.toFixed(2)),ctr:Number(clickRate.toFixed(2)),ctor:Number((uniqueOpens?uniqueClicks/uniqueOpens*100:0).toFixed(2))}, timeseries:[...daily.values()], hourlyActivity:[], domainBreakdown:[...domains.values()], senderComparison, campaignComparison });
});
