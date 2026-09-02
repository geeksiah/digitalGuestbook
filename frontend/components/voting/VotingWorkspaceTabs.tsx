'use client';

import { Tabs } from '@/components/ui/Primitives';

type VotingWorkspaceTab = 'setup' | 'categories' | 'nominees' | 'published' | 'nominations' | 'results';

const TABS: Array<{ id: VotingWorkspaceTab; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'categories', label: 'Categories' },
  { id: 'nominees', label: 'Nominees' },
  { id: 'published', label: 'Profiles' },
  { id: 'nominations', label: 'Nominations' },
  { id: 'results', label: 'Results' },
];

export default function VotingWorkspaceTabs({
  activeTab,
  onChange,
}: {
  activeTab: VotingWorkspaceTab;
  onChange: (tab: VotingWorkspaceTab) => void;
}) {
  return (
    <Tabs
      items={TABS}
      active={activeTab}
      onChange={(id) => onChange(id as VotingWorkspaceTab)}
      label="Voting sections"
    />
  );
}
