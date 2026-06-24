'use client';

import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const shortcuts = [
  { group: 'Global', keys: [
    { key: '⌘K', desc: 'Search projects and env vars' },
    { key: '⌘/', desc: 'Toggle this shortcut reference' },
    { key: 'Esc', desc: 'Close dialog / Deselect all' },
  ]},
  { group: 'Terminal', keys: [
    { key: '↑ ↓', desc: 'Navigate command history' },
    { key: 'Tab', desc: 'Autocomplete command or var name' },
    { key: '⌘L', desc: 'Clear terminal output' },
  ]},
  { group: 'Env Table', keys: [
    { key: 'Enter', desc: 'Submit add/edit dialog' },
    { key: '⇧Click', desc: 'Select range of rows' },
  ]},
];

export default function ShortcutReference({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Keyboard Shortcuts (⌘/)"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            Available keyboard shortcuts for ENVEIL.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {shortcuts.map((group) => (
            <div key={group.group}>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                {group.group}
              </h4>
              <div className="overflow-hidden rounded-lg border text-xs">
                <table className="w-full">
                  <tbody>
                    {group.keys.map((s, i) => (
                      <tr key={i} className={i > 0 ? 'border-t border-border/40' : ''}>
                        <td className="px-3 py-1.5">
                          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                            {s.key}
                          </kbd>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {s.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Press ⌘/ to toggle this reference at any time
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
