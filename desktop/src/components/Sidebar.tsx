"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  GitCompare,
  Terminal,
  LogOut,
  Sun,
  Moon,
  Monitor,
  FolderPlus,
  PanelLeftClose,
  PanelLeft,
  Github,
  Wifi,
  Share2,
  Copy,
  Keyboard,
} from "lucide-react";
import UsageGuide from "./UsageGuide";
import EditProjectDialog from "./EditProjectDialog";
import DeleteProjectDialog from "./DeleteProjectDialog";
import SettingsDialog from "./SettingsDialog";
import ShortcutReference from "./ShortcutReference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useVault } from "./VaultProvider";
import { APP_VERSION } from "@/lib/brand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Project } from "@/lib/types";
import * as lan from "@/lib/lan";

export default function Sidebar({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { state, selectProject, setView, lock, saveProject, deleteProject, duplicateProject } =
    useVault();
  const { theme, setTheme } = useTheme();
  const selected = state.selectedProjectId;
  const projects = state.vault?.projects ?? [];
  const [syncActive, setSyncActive] = useState(false);
  const [projectTab, setProjectTab] = useState<"all" | "shared">("all");
  const filteredProjects = projects.filter((p) => {
    if (projectTab === "shared" && !p.share_password) return false;
    return true;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enveil_sidebar_width');
      return saved ? Number(saved) : 224;
    }
    return 224;
  });
  const dragRef = useRef(false);
  const widthRef = useRef(sidebarWidth);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => { widthRef.current = sidebarWidth; }, [sidebarWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const newWidth = Math.max(180, Math.min(400, ev.clientX));
      widthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      dragRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('enveil_sidebar_width', String(widthRef.current));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await lan.getSyncStatus();
        setSyncActive(s.active);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const displayWidth = open ? sidebarWidth : 40;

  return (
    <div className="relative flex h-full shrink-0">
      <motion.aside
        ref={sidebarRef}
        animate={{ width: displayWidth }}
        transition={{ duration: 0.15, ease: 'easeInOut' }}
        className="flex h-full flex-col border-r bg-sidebar overflow-hidden"
      >
      {open ? (
        <>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ minWidth: sidebarWidth }}>
        <div className="flex items-baseline gap-1.5">
          <span className="font-brand font-normal tracking-tight text-sidebar-foreground text-lg">
            ENVEIL
          </span>
          <span className="text-[10px] font-mono text-sidebar-foreground/60 leading-none">v{APP_VERSION}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <UsageGuide />
          <button
            onClick={() =>
              setTheme(
                theme === "system"
                  ? "light"
                  : theme === "light"
                    ? "dark"
                    : "system",
              )
            }
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title={`Theme: ${theme}`}
          >
            {theme === "dark" ? (
              <Moon className="h-3.5 w-3.5" />
            ) : theme === "light" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Monitor className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            title={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            {open ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <Separator />

      <nav className="flex flex-col gap-0.5 px-2 py-3">
        <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Views
        </p>
        <NavButton
          icon={<LayoutDashboard className="h-4 w-4" />}
          label="Dashboard"
          active={state.activeView === "dashboard"}
          onClick={() => { selectProject(null); setView("dashboard"); }}
        />
        <NavButton
          icon={<GitCompare className="h-4 w-4" />}
          label="Compare"
          active={state.activeView === "diff"}
          onClick={() => { selectProject(null); setView("diff"); }}
        />
        <NavButton
          icon={<Terminal className="h-4 w-4" />}
          label="Terminal"
          active={state.activeView === "terminal"}
          onClick={() => { setView("terminal"); }}
        />
        <NavButton
          icon={
            <div className="relative">
              <Wifi className="h-4 w-4" />
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-sidebar",
                  syncActive ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
            </div>
          }
          label="LAN Sync"
          active={state.activeView === "lan"}
          onClick={() => { selectProject(null); setView("lan"); }}
        />
      </nav>

      <Separator />

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        <div className="flex items-center justify-between px-2 pb-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Projects
          </p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {filteredProjects.length}
          </span>
        </div>
        <div className="flex gap-1 px-2 pb-2">
          <button
            onClick={() => setProjectTab("all")}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              projectTab === "all"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          <button
            onClick={() => setProjectTab("shared")}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              projectTab === "shared"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Shared
          </button>
        </div>
        {filteredProjects.map((p) => (
          <div
            key={p.id}
            className={cn(
              "group flex w-full items-center gap-1 rounded-md pr-1 transition-colors",
              selected === p.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <button
              onClick={() => { selectProject(p.id); setView('project'); }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-primary/20 text-[10px] font-bold text-primary">
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{p.name}</span>
              {p.share_password && <Share2 className="h-3 w-3 text-amber-500 shrink-0" />}
            </button>
            <div
              className={cn(
                "shrink-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                selected === p.id && "opacity-100",
              )}
            >
              <button
                onClick={() => duplicateProject(p)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Duplicate project"
              >
                <Copy className="h-3 w-3" />
              </button>
              <DeleteProjectDialog project={p} onDelete={deleteProject} compact />
              <EditProjectDialog project={p} onSave={saveProject} compact />
            </div>
          </div>
        ))}
        {filteredProjects.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {projectTab === "shared" ? "No shared projects" : "No projects yet"}
          </p>
        )}
        <AddProjectDialog onSave={saveProject} />
      </div>

      <Separator />

      <div className="space-y-1 p-2">
        <a
          href="https://github.com/kyawsoe-dev/enveil"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-medium h-8 px-3 text-xs w-full gap-2 text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
        >
          <Github className="h-4 w-4" />
          GitHub
        </a>
          <ShortcutReference
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              >
                <Keyboard className="h-4 w-4" />
                Shortcuts
              </Button>
            }
          />
          <SettingsDialog />
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Lock Vault
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lock Vault</DialogTitle>
              <DialogDescription>
                Are you sure you want to lock the vault? You will need to enter your master password to unlock it again.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">Cancel</Button>
              </DialogTrigger>
              <Button variant="default" size="sm" onClick={lock}>Lock</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-2 min-w-[40px]">
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </motion.aside>
    {open && (
      <div
        className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize hover:w-1.5 hover:bg-primary/30 transition-all"
        onMouseDown={handleMouseDown}
      />
    )}
    </div>
  );
}

function AddProjectDialog({
  onSave,
}: {
  onSave: (p: Project) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = async () => {
    if (!name.trim()) return;
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      env_vars: {},
    };
    await onSave(project);
    setName("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start gap-2 text-muted-foreground"
        >
          <FolderPlus className="h-4 w-4" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new project to store environment variables.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2" onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleSave(); }}>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Project Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 128))}
              placeholder="my-service"
              className="font-mono text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            />
            <p className="mt-1 text-[10px] text-muted-foreground/60">{name.length}/128</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            />
          </div>
          <Button
            onClick={handleSave}
            className="w-full gap-2"
            disabled={!name.trim()}
          >
            <FolderPlus className="h-4 w-4" />
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
