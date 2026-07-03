'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, User, BarChart3 } from 'lucide-react';
import * as ai from '@/lib/ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

export default function AIChatWidget() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(100);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  const dragStartRef = useRef<{ startX: number; startY: number; btnX: number; btnY: number } | null>(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    const saved = localStorage.getItem('enveil_ai_pos');
    if (saved) {
      try { setPos(JSON.parse(saved)); } catch { /* ignore */ }
    } else {
      setPos({ x: window.innerWidth - 88, y: window.innerHeight - 88 });
    }
  }, []);

  useEffect(() => {
    ai.getAiConfig()
      .then((cfg) => setConfigured(cfg.configured))
      .catch(() => setConfigured(false));
    setRemaining(ai.getDailyRemaining());
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleButtonMouseDown = (e: React.MouseEvent) => {
    if (open) return;
    e.preventDefault();
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    dragStartRef.current = { startX: e.clientX, startY: e.clientY, btnX: rect.left, btnY: rect.top };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 56, dragStartRef.current.btnX + ev.clientX - dragStartRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 56, dragStartRef.current.btnY + ev.clientY - dragStartRef.current.startY)),
      });
    };
    const onMouseUp = () => {
      setDragging(false);
      dragStartRef.current = null;
      localStorage.setItem('enveil_ai_pos', JSON.stringify(posRef.current));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const result = await ai.callAI(text);
      setMessages((prev) => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err}` }]);
    } finally {
      setLoading(false);
      setRemaining(ai.getDailyRemaining());
    }
  };

  if (configured === false || !online) return null;

  const btnSize = 56;
  const panelW = 384;
  const panelH = 620;
  const gap = 12;

  const panelLeft = pos.x + btnSize + gap > window.innerWidth - 16 ? Math.max(16, pos.x + btnSize - panelW) : pos.x;
  const panelTop = pos.y - panelH - gap < 16 ? Math.min(window.innerHeight - panelH - 16, pos.y + btnSize + gap) : pos.y - panelH - gap;

  return (
    <div className="fixed z-50" style={{ left: pos.x, top: pos.y }}>
      {open ? (
        <div className="rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden absolute" style={{ width: panelW, height: panelH, left: panelLeft - pos.x, top: panelTop - pos.y }}>
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="rounded-full bg-primary-foreground/20 p-1.5">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">AI Assistant</p>
                <p className="text-[10px] opacity-80 leading-tight">Ask me anything</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 hover:bg-primary-foreground/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-muted/30">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="rounded-full bg-primary/10 p-3 mb-3">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">ENVEIL AI Assistant</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Ask about environment variables, DevOps secrets, or ENVEIL features.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="rounded-full bg-primary/10 p-1.5 shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="rounded-full bg-muted-foreground/10 p-1.5 shrink-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-[18px] rounded-br-[6px]'
                      : 'bg-background text-foreground border rounded-[18px] rounded-bl-[6px]'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-end gap-2">
                <div className="rounded-full bg-primary/10 p-1.5 shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-background border rounded-[18px] rounded-bl-[6px] px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t bg-background px-3 py-3 shrink-0">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5 border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-sm outline-none py-1.5 placeholder:text-muted-foreground/60"
                placeholder="Message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <button
                className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || loading}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-1 px-3 pb-2 pt-1 shrink-0">
              <BarChart3 className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[9px] text-muted-foreground/50">{remaining}/{100} daily requests</span>
            </div>
          </div>
        </div>
      ) : (
        <div ref={btnRef} className="relative group" style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            AI Assistant
          </div>
          <button
            className="relative rounded-full bg-primary p-3.5 text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl hover:scale-105 transition-all pointer-events-auto"
            onMouseDown={handleButtonMouseDown}
            onClick={() => { if (!dragging) setOpen(true); }}
          >
            <Bot className="h-5 w-5" />
            <span className="absolute -inset-2 rounded-full border border-green-400 animate-ping opacity-40" />
          </button>
        </div>
      )}
    </div>
  );
}
