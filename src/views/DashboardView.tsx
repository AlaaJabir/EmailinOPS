import React from 'react';
import { KumoOperationsDashboard } from './KumoOperationsDashboard';
import { DeliveryOverview } from './DeliveryOverview';
import { DashboardStats, Message } from '../types';

interface DashboardViewProps {
  stats: DashboardStats | null;
  recentMessages: Message[];
  onSelectMessage: (message: Message) => void;
  onNavigateToSend: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  recentMessages,
  onSelectMessage,
  onNavigateToSend,
  onRefresh,
  isLoading,
}) => {
  return (
    <div className="space-y-8">
      <DeliveryOverview
        stats={stats}
        recentMessages={recentMessages}
        onSelectMessage={onSelectMessage}
      />
      <KumoOperationsDashboard
        stats={stats}
        recentMessages={recentMessages}
        onSelectMessage={onSelectMessage}
        onNavigateToSend={onNavigateToSend}
        onRefresh={onRefresh}
        isLoading={isLoading}
      />
    </div>
  );
};
