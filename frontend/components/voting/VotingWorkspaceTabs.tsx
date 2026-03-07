type VotingWorkspaceTab = 'setup' | 'categories' | 'nominees' | 'published' | 'nominations' | 'results';

const TABS: Array<{ id: VotingWorkspaceTab; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'categories', label: 'Categories' },
  { id: 'nominees', label: 'Add Nominees' },
  { id: 'published', label: 'Published Profiles' },
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
    <div className="page-tabs overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`page-tabs-item ${activeTab === tab.id ? 'page-tabs-item-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
