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
import { db } from './server/store.js';
import { kumoMtaService } from './server/services/KumoMtaService.js';
import { sesProvider } from './server/services/SesProvider.js';
import { supabaseService } from './server/services/SupabaseService.js';
import { optionalAuth } from './server/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function dashboardStats(userId: string) {
  const client = supabaseService.getClient()!;
  const [messagesResult, eventsResult, sendersResult, campaignsResult] = await Promise.all([
    client.from('messages').select('id,internal_id,message_id,sender_id,campaign_id,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5000),
    client.from('message_events').select('message_id,event_type,timestamp').eq('user_id', userId).order('timestamp', { ascending: false }).limit(10000),
    client.from('senders').select('id,name,from_email').eq('user_id', userId),
    client.from('campaigns').select('id,name,sent_count,delivered_count,open_count,click_count').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);
  if (messagesResult.error) throw new Error(messagesResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  const messages = messagesResult.data || [], events = eventsResult.data || [];
  const count = (s: string) => messages.filter((m:any)=>m.status===s).length;
  const sent = messages.filter((m:any)=>['SENT','DELIVERED'].includes(m.status)).length;
  const delivered = count('DELIVERED'), bounced = count('BOUNCED'), failed = count('FAILED'), rejected = count('REJECTED');
  const opens = events.filter((e:any)=>e.event_type==='OPENED').length, clicks = events.filter((e:any)=>e.event_type==='CLICKED').length;
  const complaints = events.filter((e:any)=>e.event_type==='COMPLAINED').length + count('COMPLAINED');
  const delayed = events.filter((e:any)=>e.event_type==='DELIVERY_DELAY').length + count('DELIVERY_DELAYED');
  const renderingFailed = events.filter((e:any)=>e.event_type==='RENDERING_FAILURE').length + count('RENDERING_FAILED');
  const queued = messages.filter((m:any)=>['QUEUED','SENDING'].includes(m.status)).length;
  const denom = sent || 0;
  const rate = (n:number) => denom ? Number(((n/denom)*100).toFixed(2)) : 0;
  const byDay = new Map<string, any>();
  for (const m of messages) { const day=String(m.created_at).slice(0,10); const x=byDay.get(day)||{time:day,sent:0,delivered:0,bounced:0,failed:0,rejected:0}; if(['SENT','DELIVERED'].includes(m.status))x.sent++; if(m.status==='DELIVERED')x.delivered++; if(m.status==='BOUNCED')x.bounced++; if(m.status==='FAILED')x.failed++; if(m.status==='REJECTED')x.rejected++; byDay.set(day,x); }
  const byHour = new Map<string,number>(); for(const m of messages){const d=new Date(m.created_at);const h=String(d.getHours()).padStart(2,'0');byHour.set(h,(byHour.get(h)||0)+1);}
  const senderRows=sendersResult.data||[]; const topSenders=senderRows.map((s:any)=>{const ms=messages.filter((m:any)=>m.sender_id===s.id);const sv=ms.filter((m:any)=>['SENT','DELIVERED'].includes(m.status)).length;return{id:s.id,name:s.name,email:s.from_email,volume:sv,deliveryRate:sv?Number((ms.filter((m:any)=>m.status==='DELIVERED').length/sv*100).toFixed(2)):0,bounceRate:sv?Number((ms.filter((m:any)=>m.status==='BOUNCED').length/sv*100).toFixed(2)):0};}).sort((a,b)=>b.volume-a.volume).slice(0,10);
  const campaignRows=campaignsResult.data||[]; const topCampaigns=campaignRows.map((c:any)=>({id:c.id,name:c.name,sent:c.sent_count||0,delivered:c.delivered_count||0,openRate:c.sent_count?Number(((c.open_count||0)/c.sent_count*100).toFixed(2)):0,clickRate:c.sent_count?Number(((c.click_count||0)/c.sent_count*100).toFixed(2)):0})).sort((a,b)=>b.sent-a.sent).slice(0,10);
  const [kumo, ses] = await Promise.all([kumoMtaService.checkHealth(), sesProvider.checkHealth()]);
  return {totalSent:sent,delivered,bounced,failed,complaints,rejected,deliveryDelayed:delayed,renderingFailed,queued,opens,clicks,deliveryRate:rate(delivered),bounceRate:rate(bounced),openRate:rate(opens),clickRate:rate(clicks),queueSize:queued,sendingRatePerSec:0,kumoHealth:kumo.status,sesHealth:ses.status,timeseries:Array.from(byDay.values()).sort((a,b)=>a.time.localeCompare(b.time)).slice(-30),hourlyActivity:Array.from(byHour.entries()).sort().map(([hour,volume])=>({hour,volume})),topSenders,topCampaigns};
}

async function startServer() {
  const app = express(); const PORT = Number(process.env.PORT) || 3000;
  app.use(cors({ origin: ['https://emailin-ops.vercel.app', 'http://localhost:3000', 'http://localhost:5173'], credentials: true }));
  app.use(express.json({ limit: '25mb', type: ['application/json', 'text/plain'] })); app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use((req,res,next)=>{if(req.path.startsWith('/api')&&req.path!=='/api/metrics')console.log(`[API] ${req.method} ${req.path}`);next();});
  app.get('/api/health', async (_req,res)=>{const [kumoHealth,sesHealth,database]=await Promise.all([kumoMtaService.checkHealth(),sesProvider.checkHealth(),supabaseService.health()]);const status=kumoHealth.status==='healthy'&&database.healthy?'healthy':'degraded';res.status(status==='healthy'?200:503).json({status,timestamp:new Date().toISOString(),services:{api:'healthy',database,kumomta:kumoHealth,amazon_ses:sesHealth}});});
  app.get('/api/health/kumomta',async(_req,res)=>{const k=await kumoMtaService.checkHealth();res.status(k.status==='healthy'?200:503).json(k);});
  app.get('/api/dashboard/stats', optionalAuth, async(req,res)=>{if(!req.user||!supabaseService.isConfigured)return res.status(401).json({error:'Authentication required'});try{return res.json(await dashboardStats(req.user.id));}catch(err:any){return res.status(503).json({error:'Failed to load dashboard statistics',details:err?.message||String(err)});}});
  app.use('/api/auth',authRouter);app.use('/api/messages',messagesRouter);app.use('/api/campaigns',campaignsRouter);app.use('/api/senders',sendersRouter);app.use('/api/contacts',contactsRouter);app.use('/api/imports',importsRouter);app.use('/api/suppressions',suppressionsRouter);app.use('/api/analytics',analyticsRouter);app.use('/api/logs',logsRouter);app.use('/api/settings',settingsRouter);app.use('/api/metrics',metricsRouter);app.use('/api/webhooks',webhooksRouter);if(process.env.NODE_ENV!=='production'&&process.env.ENABLE_DEMO_DATA==='true')app.use('/api/seed',seedRouter);app.use('/api/tracking',trackingRouter);app.use('/api/unsubscribe',unsubscribeRouter);app.use('/api/templates',templatesRouter);app.use('/unsubscribe',unsubscribeRouter);
  if(process.env.NODE_ENV!=='production'){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}else{const distPath=path.join(process.cwd(),'dist');app.use(express.static(distPath));app.get('*',(req,res)=>res.sendFile(path.join(distPath,'index.html')));}
  app.listen(PORT,'0.0.0.0',()=>console.log(`[EmailOps] Server started on http://0.0.0.0:${PORT}`));
}
startServer();
