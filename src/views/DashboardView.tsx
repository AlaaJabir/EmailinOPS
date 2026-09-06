import React from 'react';
import { PowerDashboardView } from './PowerDashboardView';
import { DashboardStats, Message } from '../types';

interface DashboardViewProps {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = (props) => {
  return <PowerDashboardView {...props} />;
};
