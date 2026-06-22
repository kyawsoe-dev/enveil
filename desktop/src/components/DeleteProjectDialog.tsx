'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/types';

export default function DeleteProjectDialog({
  project,
  onDelete,
  compact = false,
}: {
  project: Project;
  onDelete: (id: string) => Promise<void>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onDelete(project.id);
      setOpen(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            'flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-destructive transition-colors',
            compact ? 'h-6 w-6' : 'h-7 w-7'
          )}
          title="Delete project"
        >
          <Trash2 className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Project
          </DialogTitle>
          <DialogDescription className="sr-only">
            Are you sure you want to delete this project?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2" onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) handleDelete(); }}>
          <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive-foreground dark:text-destructive-foreground">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Warning</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This will permanently delete the project <span className="font-mono font-bold text-foreground">"{project.name}"</span> and all its environment variables. This action cannot be undone.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="h-8"
              onClick={() => { setOpen(false); setError(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
              size="sm"
              disabled={isLoading}
              className="h-8 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isLoading ? 'Deleting...' : 'Delete Project'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
