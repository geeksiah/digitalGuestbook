import Link from 'next/link';

type WorkspaceAction = {
  href: string;
  label: string;
  external?: boolean;
};

export default function VotingWorkspaceHeader({
  backHref,
  eventName,
  eventSlug,
  actions,
}: {
  backHref: string;
  eventName: string;
  eventSlug?: string | null;
  actions: WorkspaceAction[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link href={backHref} className="text-sm text-surface-600 hover:text-brand-900">
          Back to event
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-brand-900">Voting Workspace</h1>
        <p className="text-sm text-surface-600">
          {eventName} {eventSlug ? `- /e/${eventSlug}/vote` : ''}
        </p>
      </div>
      {eventSlug ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              key={`${action.href}:${action.label}`}
              href={action.href}
              className="btn-outline"
              target={action.external ? '_blank' : undefined}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
