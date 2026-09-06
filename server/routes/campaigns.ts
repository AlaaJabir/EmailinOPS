import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { supabaseService } from '../services/SupabaseService.js';
import { personalizationService } from '../services/PersonalizationService.js';
import { kumoMtaService } from '../services/KumoMtaService.js';

export const campaignsRouter = Router();

function clientOr503(req: any, res: any) {
  if (!req.user || !supabaseService.isConfigured || !supabaseService.getClient()) { res.status(503).json({ error: 'Authenticated Supabase persistence is required' }); return null; }
  return supabaseService.getClient()!;
}
function buildHtml(head: unknown, body: unknown): string {
  const h = String(head || ''), b = String(body || '');
  if (!h.trim()) return b;
  if (/<html[\s>]/i.test(b)) return b.replace(/<head([^>]*)>/i, `<head$1>${h}`);
  return `<!doctype html><html><head><meta charset="utf-8">${h}</head><body>${b}</body></html>`;
}
function mapCampaign(r: any) { return {
  id:r.id,name:r.name,senderId:r.sender_id,listId:r.list_id,templateId:r.template_id,subject:r.subject,preheader:r.preheader,
  headHtml:r.head_html,htmlBody:r.html_body,plainText:r.plain_text,status:r.status,scheduledAt:r.scheduled_at,startedAt:r.started_at,
  completedAt:r.completed_at,totalRecipients:r.total_recipients,sentCount:r.sent_count,deliveredCount:r.delivered_count,bouncedCount:r.bounced_count,
  complaintCount:r.complaint_count,openCount:r.open_count,clickCount:r.click_count,trackOpens:r.track_opens,trackClicks:r.track_clicks,
  fromName:r.from_name,fromEmail:r.from_email,replyTo:r.reply_to,createdAt:r.created_at,updatedAt:r.updated_at
}; }

campaignsRouter.get('/', optionalAuth, async (req,res)=>{ const c=clientOr503(req,res); if(!c)return; const {data,error}=await c.from('campaigns').select('*').eq('user_id',req.user!.id).order('created_at',{ascending:false}); if(error)return res.status(400).json({error:error.message}); return res.json({campaigns:(data||[]).map(mapCampaign)}); });
campaignsRouter.get('/:id', optionalAuth, async (req,res)=>{ const c=clientOr503(req,res); if(!c)return; const {data:row,error}=await c.from('campaigns').select('*').eq('id',req.params.id).eq('user_id',req.user!.id).maybeSingle(); if(error)return res.status(400).json({error:error.message}); if(!row)return res.status(404).json({error:'Campaign not found'}); const {data:messages,error:me}=await c.from('messages').select('*').eq('campaign_id',row.id).eq('user_id',req.user!.id).order('created_at',{ascending:false}).limit(500); if(me)return res.status(400).json({error:me.message}); return res.json({campaign:mapCampaign(row),messages:messages||[]}); });

campaignsRouter.post('/', optionalAuth, async (req,res)=>{
  const c=clientOr503(req,res); if(!c)return;
  const {name,senderId,listId,templateId,subject,preheader,headHtml,htmlBody,plainText,scheduledAt,status,trackOpens,trackClicks,fromName,fromEmail,replyTo,customHeaders,isMarketing}=req.body;
  if(!name||!senderId||!subject)return res.status(400).json({error:'Name, sender, and subject are required'});
  const {data:sender,error:se}=await c.from('senders').select('*').eq('id',senderId).eq('user_id',req.user!.id).maybeSingle(); if(se)return res.status(400).json({error:se.message}); if(!sender)return res.status(400).json({error:'Sender not found'});
  let list:any=null; if(listId){const r=await c.from('contact_lists').select('*').eq('id',listId).eq('user_id',req.user!.id).maybeSingle(); if(r.error)return res.status(400).json({error:r.error.message}); list=r.data; if(!list)return res.status(400).json({error:'Contact list not found'});}
  if(templateId){const t=await c.from('templates').select('id').eq('id',templateId).eq('user_id',req.user!.id).maybeSingle(); if(t.error)return res.status(400).json({error:t.error.message}); if(!t.data)return res.status(400).json({error:'Template not found'});}
  const payload={user_id:req.user!.id,name:String(name).trim(),sender_id:sender.id,list_id:list?.id||null,template_id:templateId||null,subject:String(subject),preheader:preheader||'',head_html:headHtml||'',html_body:htmlBody||'',plain_text:plainText||null,status:status||'DRAFT',scheduled_at:scheduledAt||null,total_recipients:list?.member_count||0,sent_count:0,delivered_count:0,bounced_count:0,complaint_count:0,open_count:0,click_count:0,track_opens:trackOpens!==false,track_clicks:trackClicks!==false,from_name:fromName||sender.name,from_email:fromEmail||sender.from_email,reply_to:replyTo||sender.reply_to||null,custom_headers:customHeaders||{},is_marketing:isMarketing===true,unsubscribe_count:0};
  const {data,error}=await c.from('campaigns').insert(payload).select('*').single(); if(error)return res.status(400).json({error:error.message}); await supabaseService.saveTechnicalLog({id:`cmp_${data.id}`,timestamp:new Date().toISOString(),service:'Application',event:'CAMPAIGN_CREATED',severity:'INFO',response:`Campaign ${data.name} created`,details:{campaignId:data.id}},req.user!.id); return res.status(201).json({success:true,campaign:mapCampaign(data)});
});

campaignsRouter.patch('/:id/status', optionalAuth, async (req,res)=>{const c=clientOr503(req,res);if(!c)return;const {status}=req.body;if(!status)return res.status(400).json({error:'Status is required'});const patch:any={status,updated_at:new Date().toISOString()};if(status==='SENDING')patch.started_at=new Date().toISOString();if(status==='COMPLETED'||status==='FAILED')patch.completed_at=new Date().toISOString();const {data,error}=await c.from('campaigns').update(patch).eq('id',req.params.id).eq('user_id',req.user!.id).select('*').maybeSingle();if(error)return res.status(400).json({error:error.message});if(!data)return res.status(404).json({error:'Campaign not found'});return res.json({success:true,campaign:mapCampaign(data)});});

campaignsRouter.post('/:id/send', optionalAuth, async (req,res)=>{
  const c=clientOr503(req,res);if(!c)return;
  const {data:campaign,error:ce}=await c.from('campaigns').select('*').eq('id',req.params.id).eq('user_id',req.user!.id).maybeSingle();if(ce)return res.status(400).json({error:ce.message});if(!campaign)return res.status(404).json({error:'Campaign not found'});if(campaign.status==='SENDING')return res.status(409).json({error:'Campaign is already sending'});
  const {data:sender}=await c.from('senders').select('*').eq('id',campaign.sender_id).eq('user_id',req.user!.id).maybeSingle();if(!sender)return res.status(400).json({error:'Campaign sender is not available'});if(sender.status!=='active'||sender.verification!=='VERIFIED')return res.status(400).json({error:'Sender must be active and verified before sending'});
  let contacts:any[]=[];if(campaign.list_id){const m=await c.from('contact_list_members').select('contact_id').eq('list_id',campaign.list_id);if(m.error)return res.status(400).json({error:m.error.message});const ids=(m.data||[]).map((x:any)=>x.contact_id);if(ids.length){const r=await c.from('contacts').select('*').eq('user_id',req.user!.id).in('id',ids);if(r.error)return res.status(400).json({error:r.error.message});contacts=r.data||[];}}else{const r=await c.from('contacts').select('*').eq('user_id',req.user!.id);if(r.error)return res.status(400).json({error:r.error.message});contacts=r.data||[];}
  const sr=await c.from('suppressions').select('email').eq('user_id',req.user!.id);if(sr.error)return res.status(400).json({error:sr.error.message});const suppressed=new Set((sr.data||[]).map((s:any)=>String(s.email).toLowerCase()));const candidateCount=contacts.length;contacts=contacts.filter(x=>x.status==='ACTIVE'&&!suppressed.has(String(x.email).toLowerCase()));const suppressedCount=candidateCount-contacts.length;
  await c.from('campaigns').update({status:'SENDING',started_at:new Date().toISOString(),total_recipients:contacts.length,updated_at:new Date().toISOString()}).eq('id',campaign.id).eq('user_id',req.user!.id);
  const baseUrl=personalizationService.getBaseUrl(req.get('host'));const senderDomain=String(sender.from_email).split('@')[1]||'';const results:any[]=[];let sentCount=0,failedCount=0;
  for(const contact of contacts){const email=String(contact.email).trim().toLowerCase();try{
    const internalId=`msg_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;const {unsubscribeUrl}=await personalizationService.generateUnsubscribeToken({email,contactId:contact.id,messageId:internalId,campaignId:campaign.id,userId:req.user!.id,baseUrl});
    const contactModel={id:contact.id,email:contact.email,firstName:contact.first_name,lastName:contact.last_name,company:contact.company,tags:contact.tags||[],status:contact.status,createdAt:contact.created_at,updatedAt:contact.updated_at};
    let html=personalizationService.personalizeContent(buildHtml(campaign.head_html,campaign.html_body),{contact:contactModel,email,unsubscribeUrl});const subj=personalizationService.personalizeContent(campaign.subject,{contact:contactModel,email,unsubscribeUrl});
    if(campaign.track_clicks)html=personalizationService.rewriteLinksForClickTracking(html,internalId,baseUrl);if(campaign.track_opens)html=personalizationService.injectOpenTrackingPixel(html,internalId,baseUrl);
    const headers={...((campaign.custom_headers||{}) as Record<string,string>),...personalizationService.generateUnsubscribeHeaders(unsubscribeUrl,senderDomain)};
    await kumoMtaService.submitEmail({internalId,contactId:contact.id,fromName:campaign.from_name||sender.name,fromEmail:campaign.from_email||sender.from_email,replyTo:campaign.reply_to||sender.reply_to,to:email,subject:subj,htmlBody:html,plainText:campaign.plain_text||undefined,customHeaders:headers,campaignId:campaign.id,userId:req.user!.id});
    const messageRow=await c.from('messages').select('id').eq('user_id',req.user!.id).eq('internal_id',internalId).maybeSingle();
    const recipientRow={campaign_id:campaign.id,contact_id:contact.id,email,message_id:messageRow.data?.id||null,status:'SENT',sent_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const rr=await c.from('campaign_recipients').upsert(recipientRow,{onConflict:'campaign_id,email'});if(rr.error)throw new Error(`Campaign recipient persistence failed: ${rr.error.message}`);
    sentCount++;results.push({email,status:'SENT',messageId:internalId});
  }catch(err:any){failedCount++;const rr=await c.from('campaign_recipients').upsert({campaign_id:campaign.id,contact_id:contact.id,email,status:'FAILED',failure_reason:err?.message||String(err),updated_at:new Date().toISOString()},{onConflict:'campaign_id,email'});if(rr.error)console.warn('[Campaign] recipient failure persistence:',rr.error.message);results.push({email,status:'FAILED',reason:err?.message||String(err)});}}
  const finalStatus=failedCount&&!sentCount?'FAILED':'COMPLETED';const {data:finalCampaign}=await c.from('campaigns').update({status:finalStatus,sent_count:sentCount,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',campaign.id).eq('user_id',req.user!.id).select('*').single();await supabaseService.saveTechnicalLog({id:`cmp_send_${campaign.id}_${Date.now()}`,timestamp:new Date().toISOString(),service:'Application',event:'CAMPAIGN_DISPATCH_COMPLETED',severity:failedCount?'WARN':'INFO',response:`${sentCount} sent, ${failedCount} failed, ${suppressedCount} suppressed`,details:{campaignId:campaign.id,sentCount,failedCount,suppressedCount,recipientCount:contacts.length}},req.user!.id);
  return res.json({success:true,campaign:mapCampaign(finalCampaign||campaign),summary:{totalCandidates:candidateCount,sentCount,suppressedCount,failedCount},results});
});
