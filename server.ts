import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { authRouter } from './server/routes/auth.js';
import { messagesRouter } from './server/routes/messages.js';
import { campaignsRouter } from './server/routes/campaigns.js';
import { sendersRouter } from './server/routes/senders.js';
import { contactsRouter } from './server/routes/contacts.js';
import { importsRouter } from './server/routes/imports.js';
import { suppressionsRouter } from './server/routes/suppressions.js';
import { analyticsRouter } from './server/routes/analytics.js';
import { logsRouter } from './server/routes/logs.js';
import { settingsRouter } from './server/routes/settings.js';
import { metricsRouter } from './server/routes/metrics.js';
import { webhooksRouter } from './server/routes/webhooks.js';
import { seedRouter } from './server/routes/seed.js';
import { unsubscribeRouter } from './server/routes/unsubscribe.js';
import { trackingRouter } from './server/routes/tracking.js';
import { templatesRouter } from './server/routes/templates.js';
import { kumoMtaService } from './server/services/KumoMtaService.js';
import { sesProvider } from './server/services/SesProvider.js';
import { supabaseService } from './server/services/SupabaseService.js';
import { optionalAuth } from './server/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
type Period = 'today' | '7d' | '30d';
const periodDays = (period: Period) => period === 'today' ? 1 : period === '7d' ? 7 : 30;

async function dashboardStats(userId: string, period: Period = '30d') {
  const client = supabaseService.getClient()!;
  const days = periodDays(period), now = Date.now();
  const start = new Date(now - days * 86400000).toISOString();
  const previousStart = new Date(now - days * 2 * 86400000).toISOString();
  const [messagesResult, eventsResult, sendersResult, campaignsResult] = await Promise.all([
    client.from('messages').select('id,internal_id,message_id,sender_id,campaign_id,status,created_at').eq('user_id', userId).gte('created_at', previousStart).order('created_at', { ascending: false }).limit(10000),
    client.from('message_events').select('message_id,event_type,timestamp').eq('user_id', userId).gte('timestamp', previousStart).order('timestamp', { ascending: false }).limit(20000),
    client.from('senders').select('id,name,from_email').eq('user_id', userId),
    client.from('campaigns').select('id,name,sent_count,delivered_count,open_count,click_count,created_at,status,total_recipients').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);
  if (messagesResult.error) throw new Error(messagesResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  const allMessages = messagesResult.data || [], allEvents = eventsResult.data || [];
  const messages = allMessages.filter((m:any) => String(m.created_at) >= start);
  const previousMessages = allMessages.filter((m:any) => String(m.created_at) >= previousStart && String(m.created_at) < start);
  const events = allEvents.filter((e:any) => String(e.timestamp) >= start);
  const previousEvents = allEvents.filter((e:any) => String(e.timestamp) >= previousStart && String(e.timestamp) < start);
  const count = (rows:any[], s:string) => rows.filter((m:any)=>m.status===s).length;
  const sent = messages.filter((m:any)=>['SENT','DELIVERED'].includes(m.status)).length;
  const delivered = count(messages,'DELIVERED'), bounced = count(messages,'BOUNCED'), failed = count(messages,'FAILED'), rejected = count(messages,'REJECTED');
  const openMessageIds = new Set(events.filter((e:any)=>e.event_type==='OPENED').map((e:any)=>e.message_id));
  const clickMessageIds = new Set(events.filter((e:any)=>e.event_type==='CLICKED').map((e:any)=>e.message_id));
  const opens = openMessageIds.size, clicks = clickMessageIds.size;
  const rawOpenEvents = events.filter((e:any)=>e.event_type==='OPENED').length;
  const rawClickEvents = events.filter((e:any)=>e.event_type==='CLICKED').length;
  const complaints = new Set(events.filter((e:any)=>e.event_type==='COMPLAINED').map((e:any)=>e.message_id)).size + count(messages,'COMPLAINED');
  const delayed = events.filter((e:any)=>e.event_type==='DELIVERY_DELAY').length + count(messages,'DELIVERY_DELAYED');
  const renderingFailed = events.filter((e:any)=>e.event_type==='RENDERING_FAILURE').length + count(messages,'RENDERING_FAILED');
  const queued = messages.filter((m:any)=>['QUEUED','SENDING'].includes(m.status)).length;
  const rate = (n:number, d:number = sent) => d ? Number(((n/d)*100).toFixed(2)) : 0;
  const engagementRate = (n:number) => delivered ? Number(((n/delivered)*100).toFixed(2)) : 0;
  const previousSent = previousMessages.filter((m:any)=>['SENT','DELIVERED'].includes(m.status)).length;
  const previousDelivered = count(previousMessages,'DELIVERED');
  const previousOpenIds = new Set(previousEvents.filter((e:any)=>e.event_type==='OPENED').map((e:any)=>e.message_id));
  const previousClickIds = new Set(previousEvents.filter((e:any)=>e.event_type==='CLICKED').map((e:any)=>e.message_id));
  const deltaPct = (current:number, previous:number) => previous > 0 ? Number((((current-previous)/previous)*100).toFixed(1)) : current > 0 ? 100 : 0;
  const deltaPt = (current:number, previous:number) => Number((current - previous).toFixed(1));
  const byDay = new Map<string, any>();
  for (const m of messages) { const day=String(m.created_at).slice(0,10); const x=byDay.get(day)||{time:day,sent:0,delivered:0,bounced:0,failed:0,rejected:0}; if(['SENT','DELIVERED'].includes(m.status))x.sent++; if(m.status==='DELIVERED')x.delivered++; if(m.status==='BOUNCED')x.bounced++; if(m.status==='FAILED')x.failed++; if(m.status==='REJECTED')x.rejected++; byDay.set(day,x); }
  const byHour = new Map<string,number>();
  for(const m of messages){const d=new Date(m.created_at);const h=String(d.getHours()).padStart(2,'0');byHour.set(h,(byHour.get(h)||0)+1);}
  const senderRows=sendersResult.data||[];
  const topSenders=senderRows.map((s:any)=>{const ms=messages.filter((m:any)=>m.sender_id===s.id);const sv=ms.filter((m:any)=>['SENT','DELIVERED'].includes(m.status)).length;return{id:s.id,name:s.name,email:s.from_email,volume:sv,deliveryRate:sv?Number((ms.filter((m:any)=>m.status==='DELIVERED').length/sv*100).toFixed(2)):0,bounceRate:sv?Number((ms.filter((m:any)=>m.status==='BOUNCED').length/sv*100).toFixed(2)):0};}).sort((a,b)=>b.volume-a.volume).slice(0,10);
  const campaignRows=campaignsResult.data||[];
  const topCampaigns=campaignRows.map((c:any)=>({id:c.id,name:c.name,sent:c.sent_count||0,delivered:c.delivered_count||0,openRate:c.sent_count?Number(((c.open_count||0)/c.sent_count*100).toFixed(2)):0,clickRate:c.sent_count?Number(((c.click_count||0)/c.sent_count*100).toFixed(2)):0,status:c.status,totalRecipients:c.total_recipients||0,createdAt:c.created_at})).sort((a,b)=>b.sent-a.sent).slice(0,10);
  const [kumo, ses] = await Promise.all([kumoMtaService.checkHealth(), sesProvider.checkHealth()]);
  return {totalSent:sent,delivered,bounced,failed,complaints,rejected,deliveryDelayed:delayed,renderingFailed,queued,opens,clicks,rawOpenEvents,rawClickEvents,deliveryRate:rate(delivered),bounceRate:rate(bounced),openRate:engagementRate(opens),clickRate:engagementRate(clicks),queueSize:queued,sendingRatePerSec:0,kumoHealth:kumo.status,sesHealth:ses.status,timeseries:Array.from(byDay.values()).sort((a,b)=>a.time.localeCompare(b.time)).slice(-30),hourlyActivity:Array.from(byHour.entries()).sort().map(([hour,volume])=>({hour,volume})),topSenders,topCampaigns,period,sentDeltaPct:deltaPct(sent,previousSent),openRateDeltaPt:deltaPt(engagementRate(opens),previousDelivered?previousOpenIds.size/previousDelivered*100:0),clickRateDeltaPt:deltaPt(engagementRate(clicks),previousDelivered?previousClickIds.size/previousDelivered*100:0)};
}

async function startServer() {
  const app = express(); const PORT = Number(process.env.PORT) || 3000;
  app.use(cors({ origin: ['https://emailin-ops.vercel.app', 'http://localhost:3000', 'http://localhost:5173'], credentials: true }));
  app.use(express.json({ limit: '25mb', type: ['application/json', 'text/plain'] })); app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use((req,res,next)=>{if(req.path.startsWith('/api')&&req.path!=='/api/metrics')console.log(`[API] ${req.method} ${req.path}`);next();});
  app.get('/api/health', async (_req,res)=>{const [kumoHealth,sesHealth,database]=await Promise.all([kumoMtaService.checkHealth(),sesProvider.checkHealth(),supabaseService.health()]);const status=kumoHealth.status==='healthy'&&database.healthy?'healthy':'degraded';res.status(status==='healthy'?200:503).json({status,timestamp:new Date().toISOString(),services:{api:'healthy',database,kumomta:kumoHealth,amazon_ses:sesHealth}});});
  app.get('/api/health/kumomta',async(_req,res)=>{const k=await kumoMtaService.checkHealth();res.status(k.status==='healthy'?200:503).json(k);});
  app.get('/api/dashboard/stats', optionalAuth, async(req,res)=>{if(!req.user||!supabaseService.isConfigured)return res.status(401).json({error:'Authentication required'});try{const raw=String(req.query.period||'30d');const period:Period=raw==='today'||raw==='7d'||raw==='30d'?raw:'30d';return res.json(await dashboardStats(req.user.id,period));}catch(err:any){return res.status(503).json({error:'Failed to load dashboard statistics',details:err?.message||String(err)});}});
  app.use('/api/auth',authRouter);app.use('/api/messages',messagesRouter);app.use('/api/campaigns',campaignsRouter);app.use('/api/senders',sendersRouter);app.use('/api/contacts',contactsRouter);app.use('/api/imports',importsRouter);app.use('/api/suppressions',suppressionsRouter);app.use('/api/analytics',analyticsRouter);app.use('/api/logs',logsRouter);app.use('/api/settings',settingsRouter);app.use('/api/metrics',metricsRouter);app.use('/api/webhooks',webhooksRouter);if(process.env.NODE_ENV!=='production'&&process.env.ENABLE_DEMO_DATA==='true')app.use('/api/seed',seedRouter);app.use('/api/tracking',trackingRouter);app.use('/api/unsubscribe',unsubscribeRouter);app.use('/api/templates',templatesRouter);app.use('/unsubscribe',unsubscribeRouter);
  if(process.env.NODE_ENV!=='production'){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}else{const distPath=path.join(process.cwd(),'dist');app.use(express.static(distPath));app.use('/api',(req,res)=>res.status(404).json({error:'API route not found',path:req.path,method:req.method}));app.get('*',(req,res)=>res.sendFile(path.join(distPath,'index.html')));}
  app.listen(PORT,'0.0.0.0',()=>console.log(`[EmailOps] Server started on http://0.0.0.0:${PORT}`));
}
startServer();
