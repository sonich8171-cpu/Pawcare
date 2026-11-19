import {
  AlertCircle,
  Bot,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePublicData } from '../contexts/DataContext';
import { formatAppError } from '../lib/authErrors';
import {
  markConversationReadByUser,
  sendUserConversationMessage,
  subscribeConversationMessages,
  subscribeMyConversations,
} from '../services/firestoreService';
import type { SupportConversation, SupportConversationMessage } from '../types/pawcare';

type DrawerMode = null | 'ai' | 'admin';

interface AiChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isNotice?: boolean;
}

const QUICK_AI_PROMPTS = [
  'Which Dehradun localities does PawCare cover?',
  'What does a verified caregiver do during a booking?',
  'How do bookings and test-mode payments work?',
];

export function FloatingWidgets() {
  const { firebaseUser, userProfile, effectiveRole } = useAuth();
  const { platformSettings } = usePublicData();
  const [openDrawer, setOpenDrawer] = useState<DrawerMode>(null);

  // Ask PawCare AI state
  const [aiMessages, setAiMessages] = useState<AiChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! I am the PawCare Assistant. Ask me about our Dehradun pet sitting, dog walking, feeding, basic non-medical care, booking flow, or Play Zone. For any medical emergency, please contact a licensed veterinarian directly.',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);

  // Message PawCare Admin live thread state
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<SupportConversationMessage[]>([]);
  const [adminInput, setAdminInput] = useState('');
  const [adminSubject, setAdminSubject] = useState('Booking & Care Support');
  const [sendingAdmin, setSendingAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const adminScrollRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to user's live conversations when signed in as customer or caregiver
  const canUseAdminChat = Boolean(
    firebaseUser && firebaseUser.emailVerified && effectiveRole !== 'admin'
  );

  useEffect(() => {
    if (!canUseAdminChat || !firebaseUser) {
      setConversations([]);
      setActiveConvId(null);
      return;
    }
    return subscribeMyConversations(firebaseUser.uid, (list) => {
      setConversations(list);
      if (list.length > 0 && !activeConvId) {
        setActiveConvId(list[0].conversationId);
      }
    });
  }, [canUseAdminChat, firebaseUser, activeConvId]);

  useEffect(() => {
    if (!activeConvId) {
      setThreadMessages([]);
      return;
    }
    return subscribeConversationMessages(activeConvId, setThreadMessages);
  }, [activeConvId]);

  useEffect(() => {
    if (openDrawer === 'admin' && activeConvId) {
      const current = conversations.find((c) => c.conversationId === activeConvId);
      if (current?.unreadByUser) {
        markConversationReadByUser(activeConvId).catch(() => {});
      }
    }
  }, [openDrawer, activeConvId, conversations]);

  useEffect(() => {
    aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [aiMessages, openDrawer]);

  useEffect(() => {
    adminScrollRef.current?.scrollTo({ top: adminScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [threadMessages, openDrawer]);

  const unreadReplies = conversations.filter((c) => c.unreadByUser).length;

  const submitAiPrompt = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean || aiLoading) return;
    setAiInput('');
    const userMsg: AiChatMsg = { id: `u_${Date.now()}`, role: 'user', text: clean };
    const nextHistory = [...aiMessages, userMsg];
    setAiMessages(nextHistory);
    setAiLoading(true);

    try {
      const resp = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: nextHistory
            .filter((m) => !m.isNotice)
            .slice(-6)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = (await resp.json()) as { reply?: string; error?: string; configured?: boolean };
      if (!resp.ok || !data.reply) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            isNotice: true,
            text:
              data.error ||
              'PawCare AI Assistant is currently unavailable because GEMINI_API_KEY is not configured on this server. You can use Message Admin for live human help!',
          },
        ]);
      } else {
        setAiMessages((prev) => [
          ...prev,
          { id: `a_${Date.now()}`, role: 'assistant', text: data.reply || '' },
        ]);
      }
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          isNotice: true,
          text: 'Could not reach the PawCare AI endpoint right now. Please try Message Admin for direct assistance.',
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendAdminMsg = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !adminInput.trim()) return;
    setSendingAdmin(true);
    setAdminError(null);
    try {
      const targetConvId = await sendUserConversationMessage({
        conversationId: activeConvId || undefined,
        userId: firebaseUser.uid,
        userName: userProfile?.displayName || firebaseUser.displayName || 'PawCare Member',
        userEmail: userProfile?.email || firebaseUser.email || '',
        userRole: effectiveRole === 'caregiver' ? 'caregiver' : 'customer',
        subject: adminSubject,
        text: adminInput.trim(),
      });
      setActiveConvId(targetConvId);
      setAdminInput('');
    } catch (err) {
      setAdminError(formatAppError(err, 'Could not send message to admin.'));
    } finally {
      setSendingAdmin(false);
    }
  };

  // Hide widgets for signed-in Admin inside their Admin Inbox to keep workspace uncluttered
  if (effectiveRole === 'admin') {
    return null;
  }

  return (
    <>
      {/* Stacked Non-Overlapping Floating Action Buttons — Safely above Mobile Bottom Nav */}
      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex flex-col items-end gap-2.5">
        <button
          type="button"
          onClick={() => setOpenDrawer(openDrawer === 'ai' ? null : 'ai')}
          aria-label="Open Ask PawCare AI assistant"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold shadow-lg border border-emerald-700/60 transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Ask PawCare AI</span>
        </button>

        <button
          type="button"
          onClick={() => setOpenDrawer(openDrawer === 'admin' ? null : 'admin')}
          aria-label="Open live Message Admin chat"
          className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-emerald-950 text-xs font-bold shadow-lg border border-amber-300 transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Message Admin</span>
          {unreadReplies > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-950 text-white font-mono-tabular">
              {unreadReplies}
            </span>
          )}
        </button>
      </div>

      {/* Interactive Widget Drawer */}
      <AnimatePresence>
        {openDrawer && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-36 right-3 left-3 sm:left-auto sm:right-6 sm:w-[390px] md:bottom-24 z-50 bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
          >
            {/* Header */}
            <div className="bg-emerald-950 text-white px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  {openDrawer === 'ai' ? (
                    <Bot className="w-4 h-4 text-amber-300" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-amber-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold truncate">
                    {openDrawer === 'ai' ? 'Ask PawCare AI' : 'Message PawCare Admin'}
                  </p>
                  <p className="text-[11px] text-emerald-200 truncate">
                    {openDrawer === 'ai'
                      ? 'Non-medical platform guide · Dehradun'
                      : 'Direct live thread synced with Admin Inbox'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenDrawer(null)}
                aria-label="Close drawer"
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {openDrawer === 'ai' ? (
              <>
                <div
                  ref={aiScrollRef}
                  className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#FDFBF7]"
                >
                  {aiMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                          m.role === 'user'
                            ? 'bg-emerald-900 text-white rounded-br-sm'
                            : m.isNotice
                            ? 'bg-amber-50 border border-amber-200 text-amber-950 rounded-bl-sm'
                            : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="text-xs text-stone-500 italic px-1">Thinking...</div>
                  )}
                </div>

                {/* Quick Chips */}
                <div className="px-3 py-2 border-t border-stone-100 bg-white flex gap-1.5 overflow-x-auto">
                  {QUICK_AI_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => submitAiPrompt(q)}
                      disabled={aiLoading}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitAiPrompt(aiInput);
                  }}
                  className="p-3 border-t border-stone-200 bg-white flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ask about services, Dehradun areas, bookings..."
                    maxLength={400}
                    className="flex-1 px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading || !aiInput.trim()}
                    aria-label="Send question to PawCare AI"
                    className="p-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            ) : !canUseAdminChat ? (
              <div className="p-5 space-y-4 bg-[#FDFBF7] text-center">
                <p className="text-sm font-bold text-stone-900">
                  Sign in with your verified account to chat live with PawCare Admin
                </p>
                <p className="text-xs text-stone-600">
                  Messages sent here appear directly inside the Administrator Live Inbox with status updates and replies.
                </p>
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login/customer"
                    onClick={() => setOpenDrawer(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-900 text-white text-xs font-bold"
                  >
                    Customer Gmail Login
                  </Link>
                  {platformSettings.whatsappNumber && (
                    <a
                      href={`https://wa.me/${platformSettings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-4 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold"
                    >
                      Or Message via WhatsApp ({platformSettings.whatsappNumber})
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div
                  ref={adminScrollRef}
                  className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#FDFBF7]"
                >
                  {conversations.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-600">
                        Start a live conversation with the PawCare Admin team in Dehradun.
                      </p>
                      <input
                        type="text"
                        value={adminSubject}
                        onChange={(e) => setAdminSubject(e.target.value)}
                        placeholder="Topic / Subject"
                        maxLength={120}
                        className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl"
                      />
                    </div>
                  )}

                  {threadMessages.map((msg) => {
                    const isAdmin = msg.senderRole === 'admin';
                    return (
                      <div
                        key={msg.messageId}
                        className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[10px] text-stone-400 mb-0.5 px-1">
                          {isAdmin ? 'PawCare Admin' : 'You'}
                        </span>
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            isAdmin
                              ? 'bg-white border border-emerald-200 text-stone-900 rounded-bl-sm'
                              : 'bg-emerald-900 text-white rounded-br-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}

                  {adminError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{adminError}</span>
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handleSendAdminMsg}
                  className="p-3 border-t border-stone-200 bg-white flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={adminInput}
                    onChange={(e) => setAdminInput(e.target.value)}
                    placeholder="Write a message to PawCare Admin..."
                    maxLength={800}
                    className="flex-1 px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                  <button
                    type="submit"
                    disabled={sendingAdmin || !adminInput.trim()}
                    aria-label="Send message to admin"
                    className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
