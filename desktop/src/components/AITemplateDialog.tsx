'use client';

import { useState, useEffect } from 'react';
import { WandSparkles, Loader2, Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as ai from '@/lib/ai';

interface EnvVar {
  key: string;
  value: string;
  description: string;
}

export default function AITemplateDialog({
  onAdd,
  existingKeys,
}: {
  onAdd: (vars: Record<string, string>) => void;
  existingKeys: string[];
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [vars, setVars] = useState<EnvVar[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const go = () => setOnline(true);
    const goOff = () => setOnline(false);
    window.addEventListener('online', go);
    window.addEventListener('offline', goOff);
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', goOff); };
  }, []);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setVars([]);
    setSelected(new Set());
    try {
      const raw = await ai.generateEnvTemplate(description.trim());
      let json = raw.trim();
      if (json.startsWith('```')) {
        json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      }
      const parsed: EnvVar[] = JSON.parse(json);
      if (!Array.isArray(parsed)) throw new Error('AI did not return an array');
      setVars(parsed.filter((v) => v.key && /^[A-Z_][A-Z0-9_]*$/.test(v.key)));
      setSelected(new Set(parsed.map((_, i) => i)));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleVar = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd: Record<string, string> = {};
    vars.forEach((v, i) => {
      if (selected.has(i)) toAdd[v.key] = v.value;
    });
    onAdd(toAdd);
    setOpen(false);
    setDescription('');
    setVars([]);
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs px-3 gap-1.5">
          <WandSparkles className="h-3 w-3" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-primary" />
            AI .env Template
          </DialogTitle>
          <DialogDescription>
            Describe your project stack and AI will generate appropriate environment variables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={3}
            maxLength={500}
            placeholder="e.g. Next.js 14 app with Prisma ORM, PostgreSQL, Redis cache, and Stripe payments"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
          />
          <div className="flex justify-end">
            <span className="text-[10px] text-muted-foreground">{description.length}/500</span>
          </div>

          <Button
            className="w-full gap-2"
            size="sm"
            onClick={handleGenerate}
            disabled={!description.trim() || loading || !online}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
            {loading ? 'Generating...' : 'Generate Template'}
          </Button>

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded px-2 py-1">{error}</p>
          )}

          {vars.length > 0 && (
            <>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md">
                {vars.map((v, i) => {
                  const exists = existingKeys.includes(v.key);
                  const sel = selected.has(i);
                  return (
                    <label
                      key={i}
                      className={`flex items-start gap-2 px-3 py-2 text-xs cursor-pointer transition-colors ${
                        exists ? 'opacity-40 pointer-events-none' : 'hover:bg-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={sel && !exists}
                        onChange={() => toggleVar(i)}
                        disabled={exists}
                        className="mt-0.5 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono text-xs font-semibold">{v.key}</code>
                          {exists && (
                            <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">exists</span>
                          )}
                        </div>
                        <code className="block text-[10px] text-muted-foreground truncate">{v.value}</code>
                        {v.description && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{v.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <Button className="w-full gap-2" size="sm" onClick={handleAdd} disabled={selected.size === 0}>
                <Plus className="h-4 w-4" />
                Add {selected.size > 0 ? `(${selected.size})` : ''} to Vault
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
