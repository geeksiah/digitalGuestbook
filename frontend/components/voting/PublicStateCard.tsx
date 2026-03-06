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
    <div className="min-h-screen bg-surface-50 p-6">
      <div className="mx-auto max-w-xl space-y-3 card-premium p-6">
        <h1 className="text-xl font-semibold text-brand-900">{title}</h1>
        <p className="text-sm text-surface-600">{description}</p>
        <Link className="btn-outline inline-flex" href={actionHref}>
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
