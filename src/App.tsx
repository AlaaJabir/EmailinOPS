import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer, ToastMessage } from './components/Toast';
import { MessageDetailModal } from './components/MessageDetailModal';
import { useAuth } from './context/AuthContext';
import { AuthView } from './views/AuthView';

// Views
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
} from './types';

export function App() {
  const { user, profile, logout, isLoading: isAuthLoading, isConfigured, getAuthHeaders } = useAuth();

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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Authenticated fetch wrapper that automatically attaches Supabase JWT
  const authFetch = useCallback(
    (url: string, options: RequestInit = {}) => {
      const authHeaders = getAuthHeaders();
      return fetch(url, {
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers || {}),
        },
      });
    },
    [getAuthHeaders]
  );

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Data fetchers
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [authFetch]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await authFetch('/api/messages?limit=100');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [authFetch]);

  const fetchSendersAndDomains = useCallback(async () => {
    try {
      const [resSenders, resDomains] = await Promise.all([
        authFetch('/api/senders'),
        authFetch('/api/senders/domains'),
      ]);
      if (resSenders.ok) {
        const data = await resSenders.json();
        setSenders(data.senders || []);
      }
      if (resDomains.ok) {
        const data = await resDomains.json();
        setDomains(data.domains || []);
      }
    } catch (err) {
      console.error('Error fetching senders/domains:', err);
    }
  }, [authFetch]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await authFetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  }, [authFetch]);

  const fetchContactsAndLists = useCallback(async () => {
    try {
      const [resContacts, resLists] = await Promise.all([
        authFetch('/api/contacts'),
        authFetch('/api/contacts/lists'),
      ]);
      if (resContacts.ok) {
        const data = await resContacts.json();
        setContacts(data.contacts || []);
      }
      if (resLists.ok) {
        const data = await resLists.json();
        setLists(data.lists || []);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }, [authFetch]);

  const fetchSuppressions = useCallback(async () => {
    try {
      const res = await authFetch('/api/suppressions');
      if (res.ok) {
        const data = await res.json();
        setSuppressions(data.suppressions || []);
      }
    } catch (err) {
      console.error('Error fetching suppressions:', err);
    }
  }, [authFetch]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await authFetch('/api/logs?limit=100');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }, [authFetch]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await authFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
        setApiKeys(data.apiKeys || []);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, [authFetch]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchStats(),
      fetchMessages(),
      fetchSendersAndDomains(),
      fetchCampaigns(),
      fetchContactsAndLists(),
      fetchSuppressions(),
      fetchLogs(),
      fetchSettings(),
    ]);
    setIsLoading(false);
  }, [
    fetchStats,
    fetchMessages,
    fetchSendersAndDomains,
    fetchCampaigns,
    fetchContactsAndLists,
    fetchSuppressions,
    fetchLogs,
    fetchSettings,
  ]);

  // Initial load + periodic polling for real-time dashboard telemetry
  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => {
      fetchStats();
      fetchMessages();
    }, 6000);
    return () => clearInterval(interval);
  }, [refreshAll, fetchStats, fetchMessages]);

  // Action: Send Email
  const handleSendEmail = async (payload: any) => {
    try {
      const res = await authFetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'SUPPRESSED_RECIPIENT') {
          addToast('error', 'Suppressed Recipient Blocked', `Recipient is listed in active suppression table: ${data.error}`);
        } else {
          addToast('error', 'Dispatch Failed', data.error || 'Could not spool email');
        }
        return;
      }

      addToast(
        'success',
        'Injected into KumoMTA Spool',
        `RFC Message-ID: ${data.messageId || data.result?.messageId}`
      );
      refreshAll();
    } catch (err: any) {
      addToast('error', 'Connection Error', err.message);
    }
  };

  // Action: Send Test Email
  const handleSendTest = async (payload: any) => {
    try {
      const res = await authFetch('/api/messages/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        addToast('error', 'Test Failed', data.error || 'Could not send test');
        return;
      }

      addToast('success', 'Test Dispatched', `Verification email sent to ${payload.testEmail}`);
      refreshAll();
    } catch (err: any) {
      addToast('error', 'Connection Error', err.message);
    }
  };

  // Action: Simulate Traffic Stream
  const handleSimulateTraffic = async () => {
    setIsSimulating(true);
    try {
      const res = await authFetch('/api/seed/simulate-traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 5 }),
      });
      const data = await res.json();

      if (res.ok) {
        addToast('info', 'Simulated Live Traffic Batch', `Injected ${data.count} test messages into KumoMTA spool`);
        await refreshAll();
      }
    } catch (err: any) {
      addToast('error', 'Simulator Error', err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // Action: Add Sender
  const handleAddSender = async (senderData: any) => {
    try {
      const res = await authFetch('/api/senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(senderData),
      });
      if (res.ok) {
        addToast('success', 'Sender Identity Registered', `${senderData.name} (${senderData.fromEmail})`);
        fetchSendersAndDomains();
      }
    } catch (err: any) {
      addToast('error', 'Error adding sender', err.message);
    }
  };

  // Action: Add Domain
  const handleAddDomain = async (domainData: any) => {
    try {
      const res = await authFetch('/api/senders/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(domainData),
      });
      if (res.ok) {
        addToast('success', 'Domain Registered', `DNS records generated for ${domainData.domainName}`);
        fetchSendersAndDomains();
      }
    } catch (err: any) {
      addToast('error', 'Error adding domain', err.message);
    }
  };

  // Action: Create Campaign
  const handleCreateCampaign = async (campaignData: any) => {
    try {
      const res = await authFetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      });
      if (res.ok) {
        addToast('success', 'Campaign Created', `Scheduled campaign "${campaignData.name}"`);
        fetchCampaigns();
      }
    } catch (err: any) {
      addToast('error', 'Error creating campaign', err.message);
    }
  };

  // Action: Update Campaign Status
  const handleUpdateCampaignStatus = async (id: string, status: string) => {
    try {
      const res = await authFetch(`/api/campaigns/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        addToast('info', 'Campaign Status Updated', `Status changed to ${status}`);
        fetchCampaigns();
      }
    } catch (err: any) {
      addToast('error', 'Error updating campaign', err.message);
    }
  };

  // Action: Add Contact
  const handleAddContact = async (contactData: any) => {
    try {
      const res = await authFetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData),
      });
      if (res.ok) {
        addToast('success', 'Contact Added', `${contactData.email} saved to directory`);
        fetchContactsAndLists();
      }
    } catch (err: any) {
      addToast('error', 'Error adding contact', err.message);
    }
  };

  // Action: Create List
  const handleCreateList = async (listData: any) => {
    try {
      const res = await authFetch('/api/contacts/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listData),
      });
      if (res.ok) {
        addToast('success', 'Contact List Created', `List "${listData.name}" is ready`);
        fetchContactsAndLists();
      }
    } catch (err: any) {
      addToast('error', 'Error creating list', err.message);
    }
  };

  // Action: Import CSV
  const handleImportCsv = async (csvContacts: any[]) => {
    try {
      const res = await authFetch('/api/contacts/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: csvContacts }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(
          'success',
          'CSV Ingest Complete',
          `Imported ${data.importedCount} contacts (${data.suppressedBlockedCount} suppressed duplicates skipped)`
        );
        fetchContactsAndLists();
      }
    } catch (err: any) {
      addToast('error', 'CSV Import Failed', err.message);
    }
  };

  // Action: Add Suppression
  const handleAddSuppression = async (suppressionData: any) => {
    try {
      const res = await authFetch('/api/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suppressionData),
      });
      if (res.ok) {
        addToast('success', 'Address Suppressed', `${suppressionData.email} added to compliance blocklist`);
        fetchSuppressions();
      }
    } catch (err: any) {
      addToast('error', 'Error adding suppression', err.message);
    }
  };

  // Action: Remove Suppression
  const handleRemoveSuppression = async (id: string) => {
    try {
      const res = await authFetch(`/api/suppressions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('info', 'Suppression Removed', 'Address unblocked for future delivery attempts');
        fetchSuppressions();
      }
    } catch (err: any) {
      addToast('error', 'Error removing suppression', err.message);
    }
  };

  // Action: Save Settings
  const handleSaveSettings = async (category: string, values: any) => {
    try {
      const res = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, values }),
      });
      if (res.ok) {
        addToast('success', 'Configuration Saved', `${category.toUpperCase()} settings updated successfully`);
        fetchSettings();
      }
    } catch (err: any) {
      addToast('error', 'Error saving settings', err.message);
    }
  };

  // Action: Create API Key
  const handleCreateApiKey = async (name: string) => {
    const res = await authFetch('/api/settings/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    fetchSettings();
    return { secretToken: data.secretToken };
  };

  // Action: Revoke API Key
  const handleRevokeApiKey = async (id: string) => {
    try {
      const res = await authFetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('info', 'API Key Revoked', 'Token invalidated immediately');
        fetchSettings();
      }
    } catch (err: any) {
      addToast('error', 'Error revoking key', err.message);
    }
  };

  // Authentication Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <div className="text-[11px] font-mono text-[#888888] tracking-widest uppercase">
            Authenticating EmailOps Session...
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated: Show Supabase Authentication View
  if (!user) {
    return (
      <>
        <AuthView />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#E0E0E0] flex flex-row antialiased font-sans selection:bg-white/20 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        queueCount={stats?.queueSize || 14}
        user={{
          name: profile?.fullName || user.email?.split('@')[0],
          email: user.email,
          role: profile?.role,
          plan: profile?.plan,
        }}
        onLogout={logout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <Header
          onSimulateTraffic={handleSimulateTraffic}
          isSimulating={isSimulating}
          onOpenQuickSend={() => setCurrentTab('send')}
        />

        <main className="flex-1 pb-16">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              recentMessages={messages.slice(0, 10)}
              onSelectMessage={setSelectedMessage}
              onNavigateToSend={() => setCurrentTab('send')}
              onRefresh={refreshAll}
              isLoading={isLoading}
            />
          )}

          {currentTab === 'send' && (
            <SendEmailView
              senders={senders}
              domains={domains}
              onSendEmail={handleSendEmail}
              onSendTest={handleSendTest}
            />
          )}

          {currentTab === 'senders' && (
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
            />
          )}

          {currentTab === 'messages' && (
            <MessagesView
              messages={messages}
              senders={senders}
              campaigns={campaigns}
              onSelectMessage={setSelectedMessage}
              onRefresh={fetchMessages}
              isLoading={isLoading}
            />
          )}

          {currentTab === 'contacts' && (
            <ContactsView
              contacts={contacts}
              lists={lists}
              onAddContact={handleAddContact}
              onCreateList={handleCreateList}
              onImportCsv={handleImportCsv}
            />
          )}

          {currentTab === 'suppression' && (
            <SuppressionView
              suppressions={suppressions}
              onAddSuppression={handleAddSuppression}
              onRemoveSuppression={handleRemoveSuppression}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              stats={stats}
              senders={senders}
              campaigns={campaigns}
            />
          )}

          {currentTab === 'logs' && (
            <LogsView
              logs={logs}
              onRefresh={fetchLogs}
              isLoading={isLoading}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              apiKeys={apiKeys}
              onSaveSettings={handleSaveSettings}
              onCreateApiKey={handleCreateApiKey}
              onRevokeApiKey={handleRevokeApiKey}
            />
          )}
        </main>
      </div>

      {/* Message Inspection Detail Modal */}
      <MessageDetailModal
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
      />

      {/* Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
