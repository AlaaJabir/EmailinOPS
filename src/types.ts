export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type MessageStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'COMPLAINED' | 'REJECTED' | 'RENDERING_FAILED' | 'DELIVERY_DELAYED';
export type EventType = 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'COMPLAINED' | 'OPENED' | 'CLICKED' | 'UNSUBSCRIBED' | 'REJECTED' | 'RENDERING_FAILURE' | 'DELIVERY_DELAY' | 'SUBSCRIPTION';
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
export type ContactStatus = 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED';
export type SuppressionType = 'UNSUBSCRIBED' | 'HARD_BOUNCE' | 'COMPLAINT' | 'MANUAL';
export type VerificationStatus = 'VERIFIED' | 'PENDING' | 'FAILED' | 'UNVERIFIED';
export interface User { id:string; email:string; name:string; role:Role; createdAt:string; }
export interface Domain { id:string; domainName:string; spfStatus:VerificationStatus; dkimStatus:VerificationStatus; dmarcStatus:VerificationStatus; sesStatus:VerificationStatus; dkimSelector:string; dkimPublicKey:string; spfRecord:string; dmarcRecord:string; createdAt:string; updatedAt:string; }
export interface Sender { id:string; name:string; fromEmail:string; replyTo?:string; domainId:string; domainName?:string; status:'active'|'disabled'|'warming'; verification:VerificationStatus; dailyLimit:number; hourlyLimit:number; sentCount:number; deliveredCount:number; bouncedCount:number; complaintCount:number; createdAt:string; }
export interface Contact { id:string; email:string; firstName?:string; lastName?:string; company?:string; tags:string[]; status:ContactStatus; bounceReason?:string; createdAt:string; updatedAt:string; }
export interface ContactList { id:string; name:string; description?:string; memberCount:number; createdAt:string; }
export interface SuppressionItem { id:string; email:string; type:SuppressionType; reason:string; source:string; createdAt:string; }
export type Suppression = SuppressionItem;
export interface ApiKey { id:string; name:string; keyPrefix:string; createdAt:string; lastUsedAt?:string; }
export interface Template { id:string; name:string; subject:string; preheader?:string; headHtml?:string; htmlBody:string; plainText?:string; variables:string[]; fromName?:string; fromEmail?:string; replyTo?:string; customHeaders?:Record<string,string>; trackOpens?:boolean; trackClicks?:boolean; isMarketing?:boolean; createdAt:string; updatedAt?:string; }
export interface Campaign { id:string; name:string; senderId:string; senderName?:string; fromEmail?:string; listId?:string; listName?:string; templateId?:string; subject:string; preheader?:string; headHtml?:string; htmlBody:string; plainText?:string; status:CampaignStatus; scheduledAt?:string; startedAt?:string; completedAt?:string; totalRecipients:number; sentCount:number; deliveredCount:number; bouncedCount:number; complaintCount:number; openCount:number; clickCount:number; trackOpens:boolean; trackClicks:boolean; createdAt:string; }
export interface MessageEvent { id:string; messageId:string; eventType:EventType; eventData?:Record<string,any>; timestamp:string; ipAddress?:string; userAgent?:string; geo?:string; }
export interface MessageAttachment { id:string; filename:string; fileSize:number; mimeType:string; s3Url?:string; }
export interface Message { id:string; messageId:string; sesMessageId?:string; campaignId?:string; campaignName?:string; senderId:string; fromName?:string; fromEmail:string; toEmail:string; replyTo?:string; cc?:string[]; bcc?:string[]; subject:string; htmlBody?:string; plainText?:string; customHeaders?:Record<string,string>; status:MessageStatus; provider:string; providerMessageId?:string; smtpResponse?:string; bounceType?:'Hard'|'Soft'|'Transient'; bounceReason?:string; queuedAt:string; sentAt?:string; deliveredAt?:string; bouncedAt?:string; createdAt:string; events?:MessageEvent[]; attachments?:MessageAttachment[]; }
export interface TechnicalLog { id:string; timestamp:string; service:'KumoMTA'|'Amazon SES'|'Tracking'|'Webhook Processor'|'Application'; messageId?:string; event:string; severity:'INFO'|'WARN'|'ERROR'|'SUCCESS'; response:string; details?:Record<string,any>; }
export type ServiceLog = TechnicalLog;
export interface DashboardStats {
  totalSent:number; delivered:number; bounced:number; failed:number; complaints:number; rejected:number; deliveryDelayed:number; renderingFailed:number; queued:number;
  opens:number; clicks:number; rawOpenEvents?:number; rawClickEvents?:number; deliveryRate:number; bounceRate:number; openRate:number; clickRate:number; queueSize:number; sendingRatePerSec:number;
  kumoHealth:'healthy'|'degraded'|'offline'; sesHealth:'healthy'|'degraded'|'offline'; period?:'today'|'7d'|'30d'; sentDeltaPct?:number; openRateDeltaPt?:number; clickRateDeltaPt?:number;
  timeseries:Array<{time:string;sent:number;delivered:number;bounced:number;failed:number;rejected?:number}>; hourlyActivity:Array<{hour:string;volume:number}>;
  topSenders:Array<{id:string;name:string;email:string;volume:number;deliveryRate:number;bounceRate:number}>;
  topCampaigns:Array<{id:string;name:string;sent:number;delivered:number;openRate:number;clickRate:number;status?:CampaignStatus;totalRecipients?:number;createdAt?:string}>;
}
export interface PrometheusMetrics { kumomta_queue_size:number; kumomta_messages_in_flight:number; kumomta_messages_sent_total:number; kumomta_delivery_rate_per_second:number; kumomta_smtp_connection_pool_active:number; kumomta_smtp_connection_pool_idle:number; kumomta_memory_usage_bytes:number; kumomta_cpu_usage_percent:number; ses_quota_max_24_hour:number; ses_quota_sent_last_24_hour:number; ses_quota_max_send_rate:number; ses_reputation_bounce_rate:number; ses_reputation_complaint_rate:number; }
