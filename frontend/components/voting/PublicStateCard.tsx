import Link from 'next/link';

export default function PublicStateCard({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="app-hero text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">Voting update</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-surface-500">{description}</p>
          <Link className="btn-primary mt-6 inline-flex" href={actionHref}>
          {actionLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
