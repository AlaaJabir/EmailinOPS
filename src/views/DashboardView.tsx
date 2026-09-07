import React from 'react';
import { PowerDashboardView } from './PowerDashboardView';
import { DashboardStats, Domain, Message, ServiceLog } from '../types';

interface DashboardViewProps {
  stats: DashboardStats | null;
  domains?: Domain[];
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onNavigateToCampaigns?: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  logs?: ServiceLog[];
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => <PowerDashboardView {...props} />;
