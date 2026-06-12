'use client';

import { useVault } from './VaultProvider';
import { Key } from 'lucide-react';
import EnvTable from './EnvTable';

export default function ProjectView() {
  const { state } = useVault();
  const selected = state.vault?.projects.find((p) => p.id === state.selectedProjectId);

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Key className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Select a project to view its variables</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <EnvTable />
    </div>
  );
}
