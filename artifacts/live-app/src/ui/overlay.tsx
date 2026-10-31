import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { X } from 'lucide-react';
import { Toaster as SonnerToaster } from 'sonner';
import { cn } from '@/lib/cn';
import { IconButton } from './button';

/**
 * One overlay for both form factors: a bottom sheet on phones (thumb
 * reach, iOS/Android convention) and a centred dialog from 600px up.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-scrim data-[state=open]:animate-[enter_200ms_ease-out]" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            'gl-sheet fixed z-[81] flex max-h-[92dvh] flex-col bg-surface-container-low text-on-surface shadow-e5 outline-none',
            'inset-x-0 bottom-0 rounded-t-xl pb-safe data-[state=open]:animate-[sheet-up_320ms_var(--motion-emphasized-decelerate)]',
            'md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(92vw,34rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:pb-0 md:data-[state=open]:animate-pop',
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-outline/50 md:hidden" aria-hidden="true" />
          <div className="flex items-start gap-3 px-6 pt-4 pb-2">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-headline-sm">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-body-md text-on-surface-variant">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton label="قفل" size="sm" className="-me-2">
                <X />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">{children}</div>
          {footer && <div className="gl-sheet-footer grid auto-cols-fr grid-flow-col gap-3 border-t border-outline-variant px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ActionMenu({ trigger, items }: { trigger: ReactNode; items: Array<{ label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; count?: number }> }) {
  return (
    <Menu.Root dir="rtl">
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="gl-menu z-[70] min-w-48 rounded-md bg-surface-container-lowest py-2 shadow-e3 data-[state=open]:animate-pop">
          {items.map((it) => (
            <Menu.Item
              key={it.label}
              onSelect={it.onSelect}
              className={cn(
                'state-layer flex h-12 cursor-pointer items-center gap-3 px-4 text-body-lg outline-none data-[highlighted]:bg-surface-container [&_svg]:size-5',
                it.danger ? 'text-error' : 'text-on-surface',
              )}
            >
              {it.icon}
              {it.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Snackbars (M3): inverse surface, bottom, above the navigation bar. */
export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="bottom-center"
      offset={{ bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)' }}
      mobileOffset={{ bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 12px)' }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'flex w-[min(92vw,26rem)] items-center gap-3 rounded-sm bg-inverse-surface px-4 py-3.5 text-body-md text-inverse-on-surface shadow-e3 font-sans',
          title: 'text-body-md',
          description: 'text-body-sm opacity-80',
          actionButton: 'ms-auto text-label-lg text-inverse-primary',
          icon: 'shrink-0 [&_svg]:size-5',
        },
      }}
    />
  );
}
