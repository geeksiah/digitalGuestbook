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
    <section className="app-hero">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
        <Link href={backHref} className="inline-flex items-center text-sm text-surface-600 hover:text-brand-900">
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to event
        </Link>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">Voting workspace</p>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight text-brand-900">Voting Workspace</h1>
        <p className="mt-2 text-sm leading-6 text-surface-600">
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
    </section>
  );
}
