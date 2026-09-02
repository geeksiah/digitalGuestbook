'use client';

import { PageHeader } from '@/components/ui/Primitives';
import { Menu, MenuItem } from '@/components/ui/Overlay';

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
  const visible = eventSlug ? actions : [];

  return (
    <PageHeader
      title={eventName ? `${eventName} · Voting` : 'Voting'}
      backHref={backHref}
      backLabel="Event"
      meta={eventSlug ? <span className="truncate font-mono text-[12px]">/e/{eventSlug}/vote</span> : undefined}
      actions={
        visible.length > 0 ? (
          <>
            {visible.slice(0, 2).map((action) => (
              <a
                key={`${action.href}:${action.label}`}
                href={action.href}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noopener noreferrer' : undefined}
                className="btn-outline btn-sm"
              >
                {action.label}
              </a>
            ))}
            {visible.length > 2 ? (
              <Menu label="More voting links" sheetTitle="Voting links">
                {visible.slice(2).map((action) => (
                  <MenuItem
                    key={`${action.href}:${action.label}`}
                    href={action.href}
                    target={action.external ? '_blank' : undefined}
                  >
                    {action.label}
                  </MenuItem>
                ))}
              </Menu>
            ) : null}
          </>
        ) : null
      }
      mobileActions={
        visible.length > 0 ? (
          <Menu label="Voting links" sheetTitle="Voting links">
            {visible.map((action) => (
              <MenuItem
                key={`${action.href}:${action.label}`}
                href={action.href}
                target={action.external ? '_blank' : undefined}
              >
                {action.label}
              </MenuItem>
            ))}
          </Menu>
        ) : null
      }
    />
  );
}
