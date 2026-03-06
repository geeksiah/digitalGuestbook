type VotingWorkspaceTab = 'setup' | 'categories' | 'nominees' | 'nominations' | 'results';

const TABS: Array<{ id: VotingWorkspaceTab; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'categories', label: 'Categories' },
  { id: 'nominees', label: 'Nominees' },
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
    <div className="segmented max-w-2xl">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`segmented-item ${activeTab === tab.id ? 'segmented-item-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
