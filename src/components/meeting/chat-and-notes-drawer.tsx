'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MessageSquare,
  FileText,
  Send,
  Copy,
  Download,
  Trash2,
  Check,
  Smile,
  Clock,
  Sparkles,
  Bookmark,
  Share2,
  Lock,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  isLocal: boolean;
  text: string;
  timestamp: string;
  isPrivate?: boolean;
  recipientId?: string;
  recipientName?: string;
}

export interface ChatParticipantOption {
  id: string;
  name: string;
  isLocal?: boolean;
}

interface ChatAndNotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle: string;
  localUserName: string;
  onSendMessage?: (text: string, recipient?: { id: string; name: string } | null) => void;
  messages?: ChatMessage[];
  participants?: ChatParticipantOption[];
  selectedRecipientId?: string;
  onSelectRecipient?: (id: string) => void;
}

export function ChatAndNotesDrawer({
  isOpen,
  onClose,
  meetingId,
  meetingTitle,
  localUserName,
  onSendMessage,
  messages,
  participants = [],
  selectedRecipientId,
  onSelectRecipient,
}: ChatAndNotesDrawerProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const [internalRecipientId, setInternalRecipientId] = useState<string>('ALL');
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRecipientId = selectedRecipientId ?? internalRecipientId;
  const setActiveRecipientId = (id: string) => {
    setInternalRecipientId(id);
    onSelectRecipient?.(id);
  };

  const remoteParticipants = participants.filter((p) => !p.isLocal);
  const selectedRecipient =
    activeRecipientId !== 'ALL'
      ? remoteParticipants.find((p) => p.id === activeRecipientId) || null
      : null;

  // Local simulated messages state (if no socket signaling active)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'MetroMeet Bot',
      isLocal: false,
      text: 'Welcome to encrypted meeting room. Chat messages and Notepad notes are active.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Notepad State with localStorage Persistence
  const defaultNoteTemplate = `# Meeting Notes & Minutes
Meeting: ${meetingTitle || 'MetroMeet Session'}
ID: ${meetingId}
Date: ${new Date().toLocaleDateString()}

## Agenda & Discussion:
- 

## Key Decisions:
- 

## Action Items:
[ ] Follow up with team members
`;

  const [notes, setNotes] = useState<string>('');

  // Load saved notes from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `metromeet_notes_${meetingId}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      setNotes(saved);
    } else {
      setNotes(defaultNoteTemplate);
    }
  }, [meetingId]);

  // Auto-save notes to localStorage on change
  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`metromeet_notes_${meetingId}`, val);
    }
  };

  // Auto scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, localMessages, messages, isOpen]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    const isPrivate = Boolean(selectedRecipient);

    if (onSendMessage) {
      onSendMessage(text, selectedRecipient ? { id: selectedRecipient.id, name: selectedRecipient.name } : null);
    } else {
      const newMsg: ChatMessage = {
        id: 'msg_' + Date.now() + Math.random().toString(36).slice(2, 6),
        sender: localUserName || 'You',
        isLocal: true,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isPrivate,
        recipientId: selectedRecipient?.id,
        recipientName: selectedRecipient?.name,
      };
      setLocalMessages((prev) => [...prev, newMsg]);
    }
    setInputText('');
  };

  const handleCopyNotes = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    toast.success('Meeting notes copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadNotes = () => {
    const blob = new Blob([notes], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MetroMeet-Notes-${meetingId}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 1500);
    toast.success('Downloaded meeting notes as .txt');
  };

  const handleResetNotes = () => {
    if (confirm('Reset meeting notes back to default template?')) {
      handleNotesChange(defaultNoteTemplate);
      toast.info('Notes reset to default template');
    }
  };

  if (!isOpen) return null;

  const allMessages = messages !== undefined ? messages : localMessages;
  const wordCount = notes.trim().split(/\s+/).filter(Boolean).length;
  const charCount = notes.length;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[#091222]/95 backdrop-blur-2xl border-l border-[#0066FF]/25 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      {/* Drawer Header with Dual Tabs: Chat & Notepad */}
      <div className="p-3 sm:p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-gray-200">
              {allMessages.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-gradient-to-r from-[#FF7A00] to-[#E65100] text-white shadow-lg shadow-[#FF7A00]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Notepad</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-gray-200 font-mono">
              {wordCount}w
            </span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="h-8 w-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: GROUP CHAT                                                    */}
      {/* ==================================================================== */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {allMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.isLocal ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-gray-400 flex-wrap">
                  <span className="font-semibold text-gray-300">
                    {msg.isLocal ? 'You' : msg.sender}
                  </span>
                  {msg.isPrivate && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/35 text-[9px] font-black uppercase">
                      <Lock className="h-2.5 w-2.5" />
                      {msg.isLocal
                        ? `Private to ${msg.recipientName || 'Participant'}`
                        : 'Private to You'}
                    </span>
                  )}
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md ${
                    msg.isPrivate
                      ? msg.isLocal
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-xs shadow-violet-600/25 border border-violet-400/30'
                        : 'bg-violet-500/15 border border-violet-500/35 text-violet-100 rounded-bl-xs'
                      : msg.isLocal
                      ? 'bg-[#0066FF] text-white rounded-br-xs shadow-[#0066FF]/20'
                      : 'bg-white/[0.06] border border-white/[0.08] text-gray-100 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reaction Emojis, Recipient Selector & Chat Input Bar */}
          <div className="p-3 border-t border-white/[0.08] bg-[#050a14]/60 space-y-2.5">
            {/* Send To Selector (Public Everyone vs Private DM) */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
                {selectedRecipient ? (
                  <Lock className="h-3 w-3 text-violet-400" />
                ) : (
                  <Users className="h-3 w-3 text-[#388BFF]" />
                )}
                To:
              </span>
              <select
                value={selectedRecipient ? selectedRecipient.id : 'ALL'}
                onChange={(e) => setActiveRecipientId(e.target.value)}
                className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none border transition-colors cursor-pointer ${
                  selectedRecipient
                    ? 'bg-violet-500/15 border-violet-500/40 text-violet-200'
                    : 'bg-white/[0.05] border-white/[0.1] text-gray-200'
                }`}
              >
                <option value="ALL" className="bg-[#091222] text-white">
                  Everyone (Public Chat)
                </option>
                {remoteParticipants.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#091222] text-white">
                    Private: {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              {['👍', '👏', '❤️', '🔥', '🚀', '🙌'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setInputText((prev) => prev + emoji)}
                  className="text-sm p-1 rounded-lg hover:bg-white/[0.08] transition-transform hover:scale-125 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  selectedRecipient
                    ? `Private message to ${selectedRecipient.name}...`
                    : 'Send a message to everyone...'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className={`flex-1 bg-white/[0.05] border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none transition-all ${
                  selectedRecipient
                    ? 'border-violet-500/45 focus:border-violet-400'
                    : 'border-white/[0.1] focus:border-[#0066FF]'
                }`}
              />
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={!inputText.trim()}
                className="rounded-xl px-3.5 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: MEETING NOTEPAD & MINUTES                                    */}
      {/* ==================================================================== */}
      {activeTab === 'notes' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Notepad Action Toolbar */}
          <div className="p-2.5 px-4 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between text-xs text-gray-400">
            <span className="font-mono text-[11px] text-[#FFA033]">
              ● Auto-saved locally
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyNotes}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] text-gray-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Copy notes to clipboard"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>

              <button
                onClick={handleDownloadNotes}
                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] text-gray-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Download as text file"
              >
                <Download className="h-3 w-3" />
                Export
              </button>

              <button
                onClick={handleResetNotes}
                className="p-1 rounded-lg hover:bg-white/[0.1] text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Reset note template"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Rich Notepad Textarea */}
          <div className="flex-1 p-3 overflow-hidden flex flex-col">
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Write meeting agenda, discussion minutes, and action items..."
              className="flex-1 w-full bg-[#050a14]/90 border border-white/[0.08] rounded-2xl p-4 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 font-sans leading-relaxed outline-none focus:border-[#FF7A00]/70 focus:ring-1 focus:ring-[#FF7A00]/30 transition-all resize-none shadow-inner"
            />
          </div>

          {/* Notepad Footer Stats */}
          <div className="p-3 border-t border-white/[0.08] bg-[#050a14]/60 flex items-center justify-between text-[11px] text-gray-400 font-mono">
            <span>{wordCount} words • {charCount} characters</span>
            <span className="text-gray-500">MetroMeet Notepad 2.0</span>
          </div>
        </div>
      )}
    </aside>
  );
}
