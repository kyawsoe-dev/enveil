'use client';

import { useState, useEffect, useRef } from 'react';
import { VaultProvider, useVault } from '@/components/VaultProvider';
import MasterAuth from '@/components/MasterAuth';
import Sidebar from '@/components/Sidebar';
import SearchBar from '@/components/SearchBar';
import Dashboard from '@/components/Dashboard';
import ProjectView from '@/components/ProjectView';
import DiffView from '@/components/DiffView';
import TerminalRunner from '@/components/TerminalRunner';
import { Toaster } from '@/components/ui/toaster';

function AppShell() {
  const { state } = useVault();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!state.isUnlocked || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        const { checkUpdate, installUpdate } = await import('@tauri-apps/api/updater');
        const { shouldUpdate, manifest } = await checkUpdate();
        if (shouldUpdate && manifest) {
          const install = confirm(
            `Update v${manifest.version} is available. Download now?`
          );
          if (install) {
            await installUpdate();
          }
        }
      } catch {
        // Not running in Tauri
      }
    })();
  }, [state.isUnlocked]);

  if (!state.isUnlocked) {
    return <MasterAuth />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b px-2 py-1.5">
          <SearchBar />
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {state.activeView === 'dashboard' && <Dashboard />}
          {state.activeView === 'project' && <ProjectView />}
          {state.activeView === 'diff' && <DiffView />}
          {state.activeView === 'terminal' && <TerminalRunner />}
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <VaultProvider>
      <AppShell />
      <Toaster />
    </VaultProvider>
  );
}
