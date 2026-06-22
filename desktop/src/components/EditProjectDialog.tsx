'use client';

import { useState } from 'react';
import { FileEdit, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type TriggerVariant = 'icon' | 'button';

export default function EditProjectDialog({
  project,
  onSave,
  trigger = 'icon',
  compact = false,
}: {
  project: Project;
  onSave: (p: Project) => Promise<void>;
  trigger?: TriggerVariant;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);

  const resetForm = () => {
    setName(project.name);
    setDescription(project.description);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const updated: Project = { ...project, name: name.trim(), description: description.trim() };
    await onSave(updated);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger === 'button' ? (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </Button>
        ) : (
          <button
            onClick={resetForm}
            className={cn(
              'flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
              compact ? 'h-6 w-6' : 'h-7 w-7',
            )}
            title="Rename project"
          >
            <Pencil className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Project</DialogTitle>
          <DialogDescription className="sr-only">
            Update the project name and description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2" onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleSave(); }}>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Project Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 128))}
              className="text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            />
            <p className="mt-1 text-[10px] text-muted-foreground/60">{name.length}/128</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            />
          </div>
          <Button onClick={handleSave} className="w-full gap-2" disabled={!name.trim()}>
            <FileEdit className="h-4 w-4" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
