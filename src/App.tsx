import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer, ToastMessage } from './components/Toast';
import { MessageDetailModal } from './components/MessageDetailModal';
import { useAuth } from './context/AuthContext';
import { AuthView } from './views/AuthView';
import { DashboardView } from './views/DashboardView';
import { PowerMtaVmtasView } from './views/PowerMtaVmtasView';
import { PowerMtaDeliverabilityView } from './views/PowerMtaDeliverabilityView';
import { PowerMtaPoliciesView } from './views/PowerMtaPoliciesView';
import { PowerMtaServerView } from './views/PowerMtaServerView';
import { PowerMtaInstallationView } from './views/PowerMtaInstallationView';
import { PowerMtaPricingView } from './views/PowerMtaPricingView';
import { SendEmailView } from './views/SendEmailView';
import { SendersView } from './views/SendersView';
import { CampaignsView } from './views/CampaignsView';
import { MessagesView } from './views/MessagesView';
import { ContactsView } from './views/ContactsView';
import { SuppressionView } from './views/SuppressionView';
import { AnalyticsView } from './views/AnalyticsView';
import { LogsView } from './views/LogsView';
import { SettingsView } from './views/SettingsView';
import { TemplatesView } from './views/TemplatesView';
import { StorageView } from './views/StorageView';
import { KumoOperationsDashboard } from './views/KumoOperationsDashboard';
import { ImportHistoryPanel } from './components/ImportHistoryPanel';
import {
  DashboardStats,
  Message,
  Sender,
  Domain,
  Campaign,
  Contact,
  ContactList,
  Suppression,
  ServiceLog,
  ApiKey,
  Template,
} from './types';

const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.NEXT_PUBLIC_API_URL || ''
).replace(/\/$/, '');

const parseJsonSafely = async (r: Response): Promise<any> => {
  const text = await r.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const cleanSnippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    return {
      error: cleanSnippet || (r.ok ? 'Invalid response format' : `Server error (${r.status})`),
      raw: text,
    };
  }
};

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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | undefined>();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [throughputRate, setThroughputRate] = useState<number>(0);
  const prevSentRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number>(Date.now());

  const authFetch = useCallback(
    (url: string, options: RequestInit = {}) => {
      const apiUrl = url.startsWith('http')
        ? url
        : API_BASE_URL
        ? `${API_BASE_URL}${url}`
        : url;
      return fetch(apiUrl, {
        ...options,
        headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      });
    },
    [getAuthHeaders]
  );

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((p) => [...p, { id, type, title, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 6000);
  };
  const removeToast = (id: string) => setToasts((p) => p.filter((t) => t.id !== id));

  const fetchStats = useCallback(async () => {
    try {
      const [rStats, rMetrics] = await Promise.all([
        authFetch('/api/dashboard/stats?period=30d'),
        authFetch('/api/metrics').catch(() => null),
      ]);
      if (rStats.ok) {
        const d = await parseJsonSafely(rStats);
        if (d && !d.raw) {
          setStats(d);
          const now = Date.now();
          const currentSent = d.totalSent ?? 0;
          if (prevSentRef.current !== null && now > prevTimeRef.current) {
            const deltaSent = currentSent - prevSentRef.current;
            const deltaSec = (now - prevTimeRef.current) / 1000;
            if (deltaSec > 0 && deltaSent >= 0) {
              const measuredRate = deltaSent / deltaSec;
              setThroughputRate(measuredRate);
            }
          }
          prevSentRef.current = currentSent;
          prevTimeRef.current = now;
        }
      }
      if (rMetrics && rMetrics.ok) {
        const m = await parseJsonSafely(rMetrics);
        if (m && typeof m.kumomta_delivery_rate_per_second === 'number' && m.kumomta_delivery_rate_per_second > 0) {
          setThroughputRate(m.kumomta_delivery_rate_per_second);
        }
      }
    } catch (e) {
      console.error('[App] stats fetch failed', e);
    }
  }, [authFetch]);

  const fetchMessages = useCallback(async () => {
    try {
      const r = await authFetch('/api/messages?limit=100');
      if (r.ok) {
        const d = await parseJsonSafely(r);
        if (d?.messages) setMessages(d.messages);
      }
    } catch (e) {
      console.error('[App] messages fetch failed', e);
    }
  }, [authFetch]);

  const fetchSendersAndDomains = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        authFetch('/api/senders'),
        authFetch('/api/senders/domains'),
      ]);
      if (a.ok) {
        const d = await parseJsonSafely(a);
        if (d?.senders) setSenders(d.senders);
      }
      if (b.ok) {
        const d = await parseJsonSafely(b);
        if (d?.domains) setDomains(d.domains);
      }
    } catch (e) {
      console.error('[App] senders/domains fetch failed', e);
    }
  }, [authFetch]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const r = await authFetch('/api/campaigns');
      if (r.ok) {
        const d = await parseJsonSafely(r);
        if (d?.campaigns) setCampaigns(d.campaigns);
      }
    } catch (e) {
      console.error('[App] campaigns fetch failed', e);
    }
  }, [authFetch]);

  const fetchContactsAndLists = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        authFetch('/api/contacts'),
        authFetch('/api/contacts/lists'),
      ]);
      if (a.ok) {
        const d = await parseJsonSafely(a);
        if (d?.contacts) setContacts(d.contacts);
      }
      if (b.ok) {
        const d = await parseJsonSafely(b);
        if (d?.lists) setLists(d.lists);
      }
    } catch (e) {
      console.error('[App] contacts/lists fetch failed', e);
    }
  }, [authFetch]);

  const fetchSuppressions = useCallback(async () => {
    try {
      const r = await authFetch('/api/suppressions');
      if (r.ok) {
        const d = await parseJsonSafely(r);
        if (d?.suppressions) setSuppressions(d.suppressions);
      }
    } catch (e) {
      console.error('[App] suppressions fetch failed', e);
    }
  }, [authFetch]);

  const fetchLogs = useCallback(async () => {
    try {
      const r = await authFetch('/api/logs?limit=100');
      if (r.ok) {
        const d = await parseJsonSafely(r);
        if (d?.logs) setLogs(d.logs);
      }
    } catch (e) {
      console.error('[App] logs fetch failed', e);
    }
  }, [authFetch]);

  const fetchSettings = useCallback(async () => {
    try {
      const r = await authFetch('/api/settings');
      if (r.ok) {
        const d = await parseJsonSafely(r);
        if (d && !d.raw) {
          setSettings(d.settings || {});
          setApiKeys(d.apiKeys || []);
        }
      }
    } catch (e) {
      console.error('[App] settings fetch failed', e);
    }
  }, [authFetch]);

  const fetchTemplates = useCallback(async () => {
    try {
      const r = await authFetch('/api/templates');
      if (r.ok) {
        const d = await parseJsonSafely(r);
        if (d?.templates) setTemplates(d.templates);
      }
    } catch (e) {
      console.error('[App] templates fetch failed', e);
    }
  }, [authFetch]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchMessages(),
        fetchSendersAndDomains(),
        fetchCampaigns(),
        fetchContactsAndLists(),
        fetchSuppressions(),
        fetchLogs(),
        fetchSettings(),
        fetchTemplates(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchStats,
    fetchMessages,
    fetchSendersAndDomains,
    fetchCampaigns,
    fetchContactsAndLists,
    fetchSuppressions,
    fetchLogs,
    fetchSettings,
    fetchTemplates,
  ]);

  useEffect(() => {
    if (user) refreshAll();
    const id = setInterval(() => {
      if (user) {
        fetchStats();
        fetchMessages();
        fetchLogs();
      }
    }, 3000); // 3s real-time refresh
    return () => clearInterval(id);
  }, [user, refreshAll, fetchStats, fetchMessages, fetchLogs]);

  const jsonAction = async (url: string, body: any, success: string) => {
    try {
      const r = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await parseJsonSafely(r);
      if (!r.ok) {
        const errorMsg =
          d.error || (d.failures && d.failures[0]?.error) || d.message || `Request failed (${r.status})`;
        addToast('error', 'Request Failed', errorMsg);
        return false;
      }
      addToast('success', success);
      await refreshAll();
      return true;
    } catch (e: any) {
      addToast('error', 'Connection Error', e.message);
      return false;
    }
  };

  const handleSendEmail = (p: any) => jsonAction('/api/messages/send', p, 'Email injected into PowerMTA spool');
  const handleSendTest = (p: any) => jsonAction('/api/messages/test', p, `Test dispatched to ${p.testEmail}`);
  const handleAddSender = (d: any) => jsonAction('/api/senders', d, 'Sender identity registered');
  const handleAddDomain = (d: any) => jsonAction('/api/senders/domains', d, 'Domain registered');
  const handleCreateCampaign = (d: any) => jsonAction('/api/campaigns', d, `Campaign "${d.name}" created`);

  const handleUpdateCampaignStatus = async (id: string, status: string) => {
    try {
      const r = await authFetch(`/api/campaigns/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const d = await parseJsonSafely(r);
      if (!r.ok) {
        addToast('error', 'Campaign Update Failed', d.error || 'Request failed');
        return;
      }
      addToast('info', 'Campaign Updated', status);
      await fetchCampaigns();
    } catch (e: any) {
      addToast('error', 'Connection Error', e.message);
    }
  };

  const handleRunCampaign = async (id: string) => {
    try {
      const r = await authFetch(`/api/campaigns/${id}/send`, { method: 'POST' });
      const d = await parseJsonSafely(r);
      if (!r.ok) {
        addToast('error', 'Campaign Dispatch Failed', d.error || 'Failed');
        return;
      }
      addToast(
        'success',
        'Campaign Dispatched',
        `Sent ${d.summary?.sentCount || 0}; suppressed ${d.summary?.suppressedCount || 0}; failed ${
          d.summary?.failedCount || 0
        }`
      );
      await refreshAll();
    } catch (e: any) {
      addToast('error', 'Broadcast Error', e.message);
    }
  };

  const handleAddContact = (d: any) => jsonAction('/api/contacts', d, 'Contact added');
  const handleCreateList = (d: any) => jsonAction('/api/contacts/lists', d, 'Contact list created');
  const handleImportCsv = (contactsData: any[], listId?: string) =>
    jsonAction(
      '/api/contacts/import',
      { contacts: contactsData, listId: listId || undefined },
      listId ? 'CSV import completed and contacts added to the selected list' : 'CSV import completed'
    );
  const handleAddSuppression = (d: any) => jsonAction('/api/suppressions', d, 'Address suppressed');

  const handleRemoveSuppression = async (id: string) => {
    try {
      const r = await authFetch(`/api/suppressions/${id}`, { method: 'DELETE' });
      if (r.ok) {
        addToast('info', 'Suppression Removed');
        await fetchSuppressions();
      } else {
        const d = await parseJsonSafely(r);
        addToast('error', 'Remove Failed', d.error || 'Failed to remove suppression');
      }
    } catch (e: any) {
      addToast('error', 'Connection Error', e.message);
    }
  };

  const handleSaveSettings = (category: string, values: any) =>
    jsonAction('/api/settings', { category, values }, `${category} settings saved`);

  const handleCreateApiKey = async (name: string) => {
    const r = await authFetch('/api/settings/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const d = await parseJsonSafely(r);
    await fetchSettings();
    return { secretToken: d.secretToken };
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      const r = await authFetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
      if (r.ok) {
        addToast('info', 'API Key Revoked');
        await fetchSettings();
      }
    } catch (e: any) {
      addToast('error', 'Error revoking key', e.message);
    }
  };

  const useAudience = (id: string) => {
    setSelectedAudienceId(id);
    setCurrentTab('campaigns');
    addToast('info', 'Audience Selected', 'The imported audience is preselected in the campaign composer.');
  };

  if (isAuthLoading)
    return (
      <div className="min-h-screen bg-[#1e2631] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#8cc052]/30 border-t-[#8cc052] rounded-full animate-spin" />
      </div>
    );

  if (!user)
    return (
      <>
        <AuthView />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );

  return (
    <div className="min-h-screen bg-[#E8ECEF] text-gray-800 flex antialiased font-sans selection:bg-[#8B1A10] selection:text-white">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        kumoStatus={stats?.kumoHealth}
        sesStatus={stats?.sesHealth}
        queueCount={stats?.queueSize ?? 0}
        throughputPerSec={throughputRate}
        user={{
          name: profile?.fullName || user.email?.split('@')[0],
          email: user.email,
          role: profile?.role,
          plan: profile?.plan,
        }}
        onLogout={logout}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <Header
          currentTab={currentTab}
          onOpenQuickSend={() => setCurrentTab('send')}
          onRefresh={refreshAll}
          isLoading={isLoading}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          kumoStatus={stats?.kumoHealth as any}
          sesStatus={stats?.sesHealth as any}
          queueCount={stats?.queueSize ?? 0}
          throughputPerSec={throughputRate}
          lastUpdated={new Date()}
        />
        <main className="flex-1 pb-16">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              domains={domains}
              recentMessages={messages.slice(0, 10)}
              onSelectMessage={setSelectedMessage}
              onNavigateToSend={() => setCurrentTab('send')}
              onNavigateToCampaigns={() => setCurrentTab('campaigns')}
              onRefresh={refreshAll}
              isLoading={isLoading}
              authFetch={authFetch}
              onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
              throughputPerSec={throughputRate}
            />
          )}

          {currentTab === 'infra-kumo' && (
            <KumoOperationsDashboard
              stats={stats}
              recentMessages={messages}
              onSelectMessage={setSelectedMessage}
              onNavigateToSend={() => setCurrentTab('send')}
              onRefresh={refreshAll}
              isLoading={isLoading}
              authFetch={authFetch}
            />
          )}

          {currentTab === 'vmtas' && (
            <PowerMtaVmtasView authFetch={authFetch} addToast={addToast} />
          )}

          {currentTab === 'deliverability' && (
            <PowerMtaDeliverabilityView
              domains={domains}
              authFetch={authFetch}
              addToast={addToast}
            />
          )}

          {currentTab === 'policies' && (
            <PowerMtaPoliciesView authFetch={authFetch} addToast={addToast} />
          )}

          {currentTab === 'serverConfig' && (
            <PowerMtaServerView authFetch={authFetch} addToast={addToast} />
          )}

          {currentTab === 'installation' && <PowerMtaInstallationView />}

          {currentTab === 'pricing' && <PowerMtaPricingView addToast={addToast} />}

          {currentTab === 'send' && (
            <SendEmailView
              senders={senders}
              domains={domains}
              contacts={contacts}
              onSendEmail={handleSendEmail}
              onSendTest={handleSendTest}
              authFetch={authFetch}
            />
          )}

          {(currentTab === 'senders' || currentTab === 'infra-smtp') && (
            <SendersView
              senders={senders}
              domains={domains}
              onAddSender={handleAddSender}
              onAddDomain={handleAddDomain}
            />
          )}

          {currentTab === 'campaigns' && (
            <CampaignsView
              campaigns={campaigns}
              senders={senders}
              lists={lists}
              onCreateCampaign={handleCreateCampaign}
              onUpdateCampaignStatus={handleUpdateCampaignStatus}
              onRunCampaign={handleRunCampaign}
              initialListId={selectedAudienceId}
            />
          )}

          {(currentTab === 'messages' ||
            currentTab === 'queue' ||
            currentTab === 'delivery-sent' ||
            currentTab === 'delivery-delivered' ||
            currentTab === 'delivery-deferred' ||
            currentTab === 'delivery-bounced' ||
            currentTab === 'delivery-failed') && (
            <MessagesView
              messages={messages}
              senders={senders}
              campaigns={campaigns}
              onSelectMessage={setSelectedMessage}
              onRefresh={fetchMessages}
              isLoading={isLoading}
              initialStatus={
                currentTab === 'queue'
                  ? 'QUEUED'
                  : currentTab === 'delivery-sent'
                  ? 'SENT'
                  : currentTab === 'delivery-delivered'
                  ? 'DELIVERED'
                  : currentTab === 'delivery-deferred'
                  ? 'DEFERRED'
                  : currentTab === 'delivery-bounced'
                  ? 'BOUNCED'
                  : currentTab === 'delivery-failed'
                  ? 'FAILED'
                  : 'ALL'
              }
            />
          )}

          {(currentTab === 'contacts' || currentTab === 'contacts-import') && (
            <>
              <ContactsView
                contacts={contacts}
                lists={lists}
                onAddContact={handleAddContact}
                onCreateList={handleCreateList}
                onImportCsv={handleImportCsv}
              />
              <ImportHistoryPanel authFetch={authFetch} onUseAudience={useAudience} />
            </>
          )}

          {(currentTab === 'suppression' || currentTab === 'optimization') && (
            <SuppressionView
              suppressions={suppressions}
              onAddSuppression={handleAddSuppression}
              onRemoveSuppression={handleRemoveSuppression}
            />
          )}

          {(currentTab === 'analytics' ||
            currentTab === 'analytics-performance' ||
            currentTab === 'analytics-engagement' ||
            currentTab === 'analytics-reputation') && (
            <AnalyticsView stats={stats} senders={senders} campaigns={campaigns} />
          )}

          {currentTab === 'templates' && (
            <TemplatesView
              templates={templates}
              authFetch={authFetch}
              onRefresh={fetchTemplates}
            />
          )}

          {(currentTab === 'logs' || currentTab === 'system-health') && (
            <LogsView logs={logs} onRefresh={fetchLogs} isLoading={isLoading} />
          )}

          {(currentTab === 'settings' ||
            currentTab === 'settings-general' ||
            currentTab === 'settings-account' ||
            currentTab === 'email-config') && (
            <SettingsView
              settings={settings}
              apiKeys={apiKeys}
              onSaveSettings={handleSaveSettings}
              onCreateApiKey={handleCreateApiKey}
              onRevokeApiKey={handleRevokeApiKey}
            />
          )}

          {currentTab === 'storage' && (
            <StorageView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              authFetch={authFetch}
            />
          )}
        </main>
      </div>
      <MessageDetailModal message={selectedMessage} onClose={() => setSelectedMessage(null)} />
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
