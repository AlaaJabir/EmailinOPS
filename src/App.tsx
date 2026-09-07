import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer, ToastMessage } from './components/Toast';
import { MessageDetailModal } from './components/MessageDetailModal';
import { useAuth } from './context/AuthContext';
import { AuthView } from './views/AuthView';
import { DashboardView } from './views/DashboardView';
import { SendEmailView } from './views/SendEmailView';
import { SendersView } from './views/SendersView';
import { CampaignsView } from './views/CampaignsView';
import { MessagesView } from './views/MessagesView';
import { ContactsView } from './views/ContactsView';
import { SuppressionView } from './views/SuppressionView';
import { AnalyticsView } from './views/AnalyticsView';
import { LogsView } from './views/LogsView';
import { SettingsView } from './views/SettingsView';
import { ImportHistoryPanel } from './components/ImportHistoryPanel';
import { DashboardStats, Message, Sender, Domain, Campaign, Contact, ContactList, Suppression, ServiceLog, ApiKey } from './types';

export function App() {
  const { user, profile, logout, isLoading: isAuthLoading, getAuthHeaders } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | undefined>();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const authFetch = useCallback((url: string, options: RequestInit = {}) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const apiUrl = url.startsWith('http') ? url : apiBaseUrl + url;
    return fetch(apiUrl, { ...options, headers: { ...getAuthHeaders(), ...(options.headers || {}) } });
  }, [getAuthHeaders]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => { const id=`toast_${Date.now()}_${Math.random()}`; setToasts(prev=>[...prev,{id,type,title,message}]); setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),5000); };
  const removeToast = (id:string)=>setToasts(prev=>prev.filter(t=>t.id!==id));
  const fetchStats=useCallback(async()=>{try{const r=await authFetch('/api/dashboard/stats');if(r.ok)setStats(await r.json());}catch(e){console.error(e);}},[authFetch]);
  const fetchMessages=useCallback(async()=>{try{const r=await authFetch('/api/messages?limit=100');if(r.ok){const d=await r.json();setMessages(d.messages||[]);}}catch(e){console.error(e);}},[authFetch]);
  const fetchSendersAndDomains=useCallback(async()=>{try{const[a,b]=await Promise.all([authFetch('/api/senders'),authFetch('/api/senders/domains')]);if(a.ok){const d=await a.json();const loaded=d.senders||[];const preferredEmail='service@amiralucia.com';const ordered=[...loaded].sort((x,y)=>{const xp=x.fromEmail?.toLowerCase()===preferredEmail?0:(x.status==='active'&&x.verification==='VERIFIED'?1:2);const yp=y.fromEmail?.toLowerCase()===preferredEmail?0:(y.status==='active'&&y.verification==='VERIFIED'?1:2);return xp-yp;});setSenders(ordered);}if(b.ok){const d=await b.json();setDomains(d.domains||[]);}}catch(e){console.error(e);}},[authFetch]);
  const fetchCampaigns=useCallback(async()=>{try{const r=await authFetch('/api/campaigns');if(r.ok){const d=await r.json();setCampaigns(d.campaigns||[]);}}catch(e){console.error(e);}},[authFetch]);
  const fetchContactsAndLists=useCallback(async()=>{try{const[a,b]=await Promise.all([authFetch('/api/contacts'),authFetch('/api/contacts/lists')]);if(a.ok){const d=await a.json();setContacts(d.contacts||[]);}if(b.ok){const d=await b.json();setLists(d.lists||[]);}}catch(e){console.error(e);}},[authFetch]);
  const fetchSuppressions=useCallback(async()=>{try{const r=await authFetch('/api/suppressions');if(r.ok){const d=await r.json();setSuppressions(d.suppressions||[]);}}catch(e){console.error(e);}},[authFetch]);
  const fetchLogs=useCallback(async()=>{try{const r=await authFetch('/api/logs?limit=100');if(r.ok){const d=await r.json();setLogs(d.logs||[]);}}catch(e){console.error(e);}},[authFetch]);
  const fetchSettings=useCallback(async()=>{try{const r=await authFetch('/api/settings');if(r.ok){const d=await r.json();setSettings(d.settings||{});setApiKeys(d.apiKeys||[]);}}catch(e){console.error(e);}},[authFetch]);
  const refreshAll=useCallback(async()=>{setIsLoading(true);try{await Promise.all([fetchStats(),fetchMessages(),fetchSendersAndDomains(),fetchCampaigns(),fetchContactsAndLists(),fetchSuppressions(),fetchLogs(),fetchSettings()]);}finally{setIsLoading(false);}},[fetchStats,fetchMessages,fetchSendersAndDomains,fetchCampaigns,fetchContactsAndLists,fetchSuppressions,fetchLogs,fetchSettings]);
  useEffect(()=>{refreshAll();const id=setInterval(()=>{fetchStats();fetchMessages();fetchLogs();},6000);return()=>clearInterval(id);},[refreshAll,fetchStats,fetchMessages,fetchLogs]);
  const jsonAction=async(url:string,body:any,success:string)=>{try{const r=await authFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const text=await r.text();let d:any={};try{d=text?JSON.parse(text):{};}catch{}if(!r.ok){addToast('error','Request Failed',d.error||'Request failed');return false;}addToast('success',success);await refreshAll();return true;}catch(e:any){addToast('error','Connection Error',e.message);return false;}};
  const handleSendEmail=(payload:any)=>jsonAction('/api/messages/send',payload,'Email injected into KumoMTA spool');
  const handleSendTest=(payload:any)=>jsonAction('/api/messages/test',payload,`Test dispatched to ${payload.testEmail}`);
  const handleAddSender=(d:any)=>jsonAction('/api/senders',d,'Sender identity registered');
  const handleAddDomain=(d:any)=>jsonAction('/api/senders/domains',d,'Domain registered');
  const handleCreateCampaign=(d:any)=>jsonAction('/api/campaigns',d,`Campaign "${d.name}" created`);
  const handleUpdateCampaignStatus=async(id:string,status:string)=>{try{const r=await authFetch(`/api/campaigns/${id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const text=await r.text();let d:any={};try{d=text?JSON.parse(text):{};}catch{}if(!r.ok){addToast('error','Campaign Update Failed',d.error||'Request failed');return;}addToast('info','Campaign Updated',status);await fetchCampaigns();}catch(e:any){addToast('error','Connection Error',e.message);}};
  const handleRunCampaign=async(id:string)=>{try{const r=await authFetch(`/api/campaigns/${id}/send`,{method:'POST'});const text=await r.text();let d:any={};try{d=text?JSON.parse(text):{};}catch{}if(!r.ok){addToast('error','Campaign Dispatch Failed',d.error||'Failed');return;}addToast('success','Campaign Dispatched',`Sent ${d.summary?.sentCount||0}; suppressed ${d.summary?.suppressedCount||0}; failed ${d.summary?.failedCount||0}`);await refreshAll();}catch(e:any){addToast('error','Broadcast Error',e.message);}};
  const handleAddContact=(d:any)=>jsonAction('/api/contacts',d,'Contact added');
  const handleCreateList=(d:any)=>jsonAction('/api/contacts/lists',d,'Contact list created');
  const handleImportCsv=(d:any[])=>jsonAction('/api/contacts/import',{contacts:d},'CSV import completed');
  const handleAddSuppression=(d:any)=>jsonAction('/api/suppressions',d,'Address suppressed');
  const handleRemoveSuppression=async(id:string)=>{try{const r=await authFetch(`/api/suppressions/${id}`,{method:'DELETE'});if(r.ok){addToast('info','Suppression Removed');await fetchSuppressions();}else{const d=await r.json();addToast('error','Remove Failed',d.error);}}catch(e:any){addToast('error','Connection Error',e.message);}};
  const handleSaveSettings=(category:string,values:any)=>jsonAction('/api/settings',{category,values},`${category} settings saved`);
  const handleCreateApiKey=async(name:string)=>{const r=await authFetch('/api/settings/api-keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const d=await r.json();await fetchSettings();return{secretToken:d.secretToken};};
  const handleRevokeApiKey=async(id:string)=>{try{const r=await authFetch(`/api/settings/api-keys/${id}`,{method:'DELETE'});if(r.ok){addToast('info','API Key Revoked');await fetchSettings();}}catch(e:any){addToast('error','Error revoking key',e.message);}};
  const useAudience=(listId:string)=>{setSelectedAudienceId(listId);setCurrentTab('campaigns');addToast('info','Audience Selected','The imported audience is preselected in the campaign composer.');};

  if(isAuthLoading)return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"/></div>;
  if(!user)return <><AuthView/><ToastContainer toasts={toasts} onDismiss={removeToast}/></>;
  return <div className="min-h-screen bg-[#050505] text-[#E0E0E0] flex antialiased font-sans"><Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} kumoStatus={stats?.kumoHealth} sesStatus={stats?.sesHealth} queueCount={stats?.queueSize??0} user={{name:profile?.fullName||user.email?.split('@')[0],email:user.email,role:profile?.role,plan:profile?.plan}} onLogout={logout}/><div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto"><Header onSimulateTraffic={undefined} isSimulating={false} onOpenQuickSend={()=>setCurrentTab('send')}/><main className="flex-1 pb-16">
      {currentTab==='dashboard'&&<DashboardView stats={stats} recentMessages={messages.slice(0,10)} onSelectMessage={setSelectedMessage} onNavigateToSend={()=>setCurrentTab('send')} onRefresh={refreshAll} isLoading={isLoading} authFetch={authFetch} logs={logs}/>} 
      {currentTab==='send'&&<SendEmailView senders={senders} domains={domains} contacts={contacts} onSendEmail={handleSendEmail} onSendTest={handleSendTest} authFetch={authFetch}/>} 
      {currentTab==='senders'&&<SendersView senders={senders} domains={domains} onAddSender={handleAddSender} onAddDomain={handleAddDomain}/>} 
      {currentTab==='campaigns'&&<CampaignsView campaigns={campaigns} senders={senders} lists={lists} onCreateCampaign={handleCreateCampaign} onUpdateCampaignStatus={handleUpdateCampaignStatus} onRunCampaign={handleRunCampaign} initialListId={selectedAudienceId}/>} 
      {currentTab==='messages'&&<MessagesView messages={messages} senders={senders} campaigns={campaigns} onSelectMessage={setSelectedMessage} onRefresh={fetchMessages} isLoading={isLoading}/>} 
      {currentTab==='contacts'&&<><ContactsView contacts={contacts} lists={lists} onAddContact={handleAddContact} onCreateList={handleCreateList} onImportCsv={handleImportCsv}/><ImportHistoryPanel authFetch={authFetch} onUseAudience={useAudience}/></>} 
      {currentTab==='suppression'&&<SuppressionView suppressions={suppressions} onAddSuppression={handleAddSuppression} onRemoveSuppression={handleRemoveSuppression}/>} 
      {currentTab==='analytics'&&<AnalyticsView stats={stats} senders={senders} campaigns={campaigns}/>} 
      {currentTab==='logs'&&<LogsView logs={logs} onRefresh={fetchLogs} isLoading={isLoading}/>} 
      {currentTab==='settings'&&<SettingsView settings={settings} apiKeys={apiKeys} onSaveSettings={handleSaveSettings} onCreateApiKey={handleCreateApiKey} onRevokeApiKey={handleRevokeApiKey}/>} 
    </main></div><MessageDetailModal message={selectedMessage} onClose={()=>setSelectedMessage(null)}/><ToastContainer toasts={toasts} onDismiss={removeToast}/></div>;
}
export default App;
