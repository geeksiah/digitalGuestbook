'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Shared overlay plumbing
   - one scroll lock, reference counted, so nested overlays behave
   - Escape closes the top-most overlay
   - focus moves into the overlay and is restored to the opener on close
   ========================================================================== */

let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function lockScroll() {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    const body = document.body;
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
  }
  lockCount += 1;
}

function unlockScroll() {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

function usePortal() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useDialogBehaviour(open: boolean, onClose: () => void, container: React.RefObject<HTMLElement>) {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement) || null;
    lockScroll();

    const node = container.current;
    if (node) {
      const first = node.querySelector<HTMLElement>('[data-autofocus]') || node.querySelector<HTMLElement>(FOCUSABLE);
      // Focus the panel itself when it has no controls, so Escape still works.
      (first || node).focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = container.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        event.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      unlockScroll();
      const opener = openerRef.current;
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/* ============================================================ Modal / Sheet */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
};

/**
 * Dialog on desktop, bottom sheet on mobile. Body scrolls, header and footer
 * stay put, so long forms never lose their action row.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  hideClose,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
  hideClose?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  const mounted = usePortal();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useDialogBehaviour(open, onClose, panelRef);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="modal-overlay animate-in" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn('modal-content animate-sheet-up', SIZE_CLASS[size], className)}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="modal-header">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold leading-6 tracking-tight text-brand-900">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-[13px] leading-5 text-surface-600">
                {description}
              </p>
            ) : null}
          </div>
          {hideClose ? null : (
            <button type="button" onClick={onClose} className="icon-btn -mr-2 -mt-1.5" aria-label="Close">
              <CloseIcon />
            </button>
          )}
        </div>
        <div className={cn('modal-body', bodyClassName)}>{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

/** Destructive/irreversible confirmation. States the consequence, not "are you sure". */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          {/* Focus starts on Cancel so a stray Enter never destroys anything. */}
          <button type="button" data-autofocus className="btn-outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {typeof body === 'string' ? <p className="text-sm leading-6 text-surface-700">{body}</p> : body}
    </Modal>
  );
}

/* =================================================================== Menu */

type MenuCtx = { close: () => void };
const MenuContext = createContext<MenuCtx>({ close: () => {} });

/**
 * Trigger + anchored menu. Flips and clamps to the viewport, becomes a bottom
 * sheet under 640px so options stay thumb-reachable.
 */
export function Menu({
  trigger,
  children,
  align = 'end',
  label = 'More actions',
  sheetTitle,
  className,
}: {
  trigger?: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  label?: string;
  sheetTitle?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const mounted = usePortal();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const place = useCallback(() => {
    const anchor = triggerRef.current;
    const node = menuRef.current;
    if (!anchor || !node) return;
    const rect = anchor.getBoundingClientRect();
    const menuRect = node.getBoundingClientRect();
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const flip = spaceBelow < Math.min(menuRect.height, 220) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, (flip ? spaceAbove : spaceBelow) - 4);
    const width = menuRect.width;
    let left = align === 'end' ? rect.right - width : rect.left;
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin));
    const top = flip ? Math.max(margin, rect.top - Math.min(menuRect.height, maxHeight) - 4) : rect.bottom + 4;
    setPos({ top, left, width, maxHeight });
  }, [align]);

  useLayoutEffect(() => {
    if (!open || isMobile) return;
    place();
    const onScrollOrResize = () => place();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, isMobile, place]);

  useEffect(() => {
    if (!open || isMobile) return;
    const onPointer = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (triggerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'Tab') {
        setOpen(false);
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]') || []).filter(
        (el) => !el.hasAttribute('disabled')
      );
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next].focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || isMobile) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[data-menu-item]');
    first?.focus({ preventScroll: true });
  }, [open, isMobile]);

  const ctx = useMemo(() => ({ close }), [close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={trigger ? undefined : label}
        title={trigger ? undefined : label}
        onClick={() => setOpen((value) => !value)}
        className={cn(trigger ? undefined : 'icon-btn', className)}
      >
        {trigger || <MoreIcon />}
      </button>

      {mounted && open && isMobile
        ? createPortal(
            <MenuContext.Provider value={ctx}>
              <Modal open onClose={close} title={sheetTitle || label} size="sm" bodyClassName="px-2 pb-2 pt-2">
                <div className="space-y-0.5">{children}</div>
              </Modal>
            </MenuContext.Provider>,
            document.body
          )
        : null}

      {mounted && open && !isMobile
        ? createPortal(
            <MenuContext.Provider value={ctx}>
              <div
                ref={menuRef}
                role="menu"
                aria-label={label}
                className="menu animate-slide-up fixed overflow-y-auto"
                style={{
                  top: pos?.top ?? -9999,
                  left: pos?.left ?? -9999,
                  maxHeight: pos?.maxHeight,
                  visibility: pos ? 'visible' : 'hidden',
                }}
              >
                {children}
              </div>
            </MenuContext.Provider>,
            document.body
          )
        : null}
    </>
  );
}

export function MenuItem({
  children,
  onClick,
  href,
  target,
  danger,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const { close } = useContext(MenuContext);
  const className = danger ? 'menu-item-danger' : 'menu-item';

  if (href) {
    return (
      <a
        data-menu-item
        role="menuitem"
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        className={className}
        onClick={close}
      >
        {icon ? <span className="shrink-0 text-surface-500">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">{children}</span>
      </a>
    );
  }

  return (
    <button
      data-menu-item
      role="menuitem"
      type="button"
      disabled={disabled}
      className={className}
      onClick={() => {
        close();
        onClick?.();
      }}
    >
      {icon ? <span className="shrink-0 text-surface-500">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div className="menu-sep" role="separator" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu-label">{children}</div>;
}

/* ================================================================== icons */

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 5.5h.01M12 12h.01M12 18.5h.01"
      />
    </svg>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 shrink-0 animate-spin', className)} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
      <path
        className="opacity-90"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        d="M12 2a10 10 0 0 1 10 10"
      />
    </svg>
  );
}
