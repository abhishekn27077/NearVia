/**
 * NEARVIA In-App Messaging Page
 * Real-time worker-provider communication with Supabase Realtime synchronization,
 * thread history, and active shift context.
 */

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Send,
  Search,
  ArrowLeft,
  Briefcase,
  CheckCheck,
  Shield,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { supabase } from "../../lib/supabaseClient";
import { ConversationItem, MessageItem } from "./types";

export const MessagesPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId || null,
  );
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessageText, setNewMessageText] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch user conversations
  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const items: ConversationItem[] = json.data || [];
        setConversations(items);

        // Auto-select first conversation on desktop if none selected
        if (!activeConversationId && items.length > 0 && window.innerWidth >= 768) {
          setActiveConversationId(items[0].id);
        }
      }
    } catch {
      setError("Unable to load conversations. Please check your network.");
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [token]);

  // 2. Fetch messages for active conversation
  const fetchMessages = async (convId: string) => {
    if (!token || !convId) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/messages/conversations/${convId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const json = await res.json();
        setMessages(json.data || []);
        // Reset unread count locally for this conversation
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)),
        );
      }
    } catch {
      setError("Failed to load message thread.");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId, token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 3. Supabase Realtime Subscription for incoming messages
  useEffect(() => {
    if (!activeConversationId) return;

    const channel = supabase
      .channel(`conversation-${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg) {
            // Append message if not already present
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [
                ...prev,
                {
                  id: newMsg.id,
                  conversationId: newMsg.conversation_id,
                  senderId: newMsg.sender_id,
                  senderName: newMsg.sender_id === user?.id ? "You" : "Counterparty",
                  recipientId: newMsg.recipient_id,
                  content: newMsg.content,
                  isMine: newMsg.sender_id === user?.id,
                  readAt: newMsg.read_at,
                  createdAt: newMsg.created_at,
                },
              ];
            });

            // Update conversations list preview
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeConversationId
                  ? {
                      ...c,
                      lastMessageText: newMsg.content,
                      lastMessageAt: newMsg.created_at,
                    }
                  : c,
              ),
            );
          }
        },
      )
      .subscribe();

    // Secondary fallback poller every 8s
    const poller = setInterval(() => {
      if (activeConversationId) {
        fetch(`${webConfig.apiBaseUrl}/messages/conversations/${activeConversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => {
            if (json?.data) setMessages(json.data);
          })
          .catch(() => {});
      }
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poller);
    };
  }, [activeConversationId, token, user?.id]);

  // 4. Send Message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeConversationId || isSending) return;

    const textToSend = newMessageText.trim();
    setNewMessageText("");
    setIsSending(true);

    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/messages/conversations/${activeConversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: textToSend }),
        },
      );

      if (res.ok) {
        const json = await res.json();
        const sentMessage: MessageItem = json.data;
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMessage.id)) return prev;
          return [...prev, sentMessage];
        });

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  lastMessageText: sentMessage.content,
                  lastMessageAt: sentMessage.createdAt,
                }
              : c,
          ),
        );
      } else {
        const errJson = await res.json();
        setError(errJson.message || "Failed to send message.");
      }
    } catch {
      setError("Network error while sending message.");
    } finally {
      setIsSending(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const isWorker = user?.role === "WORKER";

  const getCounterpartyName = (conv: ConversationItem) => {
    return isWorker
      ? conv.providerBusinessName || conv.providerFullName
      : conv.workerFullName;
  };

  const filteredConversations = conversations.filter((c) => {
    const name = getCounterpartyName(c).toLowerCase();
    const title = c.opportunityTitle.toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || title.includes(q);
  });

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden h-[750px] flex flex-col md:flex-row">
        {/* Left: Conversation List Panel */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 ${
            activeConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-900 font-display">
                    Messages
                  </h1>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Verified shift & applicant communication
                  </p>
                </div>
              </div>
              <button
                onClick={fetchConversations}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Refresh conversations"
                aria-label="Refresh conversations"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                id="search-conversations-input"
                name="searchQuery"
                aria-label="Search conversations"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoadingConversations ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Loading conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-3">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-medium">
                  {searchQuery
                    ? "No conversations match your search."
                    : "No active messages yet. Apply for a shift or accept a candidate to start chatting."}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const counterpartyName = getCounterpartyName(conv);

                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      navigate(`/messages/${conv.id}`);
                    }}
                    className={`w-full text-left p-3.5 transition-all flex items-start space-x-3 ${
                      isActive
                        ? "bg-blue-50/70 border-l-4 border-blue-600 shadow-xs"
                        : "hover:bg-white"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {counterpartyName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold text-slate-900 truncate">
                          {counterpartyName}
                        </h2>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 mt-0.5">
                        <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[11px] text-slate-500 font-medium truncate">
                          {conv.opportunityTitle}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-1">
                        {conv.lastMessageText || "Conversation started."}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Message Thread */}
        <div
          className={`flex-1 flex flex-col bg-white ${
            !activeConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          {activeConv ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/95 backdrop-blur-xs">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setActiveConversationId(null);
                      navigate("/messages");
                    }}
                    className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 text-slate-600"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                    {getCounterpartyName(activeConv).charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-extrabold text-slate-900">
                        {getCounterpartyName(activeConv)}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        {isWorker ? "EMPLOYER" : "WORKER"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                      <Briefcase className="w-3 h-3 text-slate-400" />
                      <span className="font-semibold text-slate-700">
                        {activeConv.opportunityTitle}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Nearvia Channel</span>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">Loading chat history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 text-center max-w-sm mx-auto">
                    <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">
                      Direct Communication Channel Active
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Discuss arrival timings, exact on-site directions, or shift details.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.isMine ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="flex items-end space-x-1.5 max-w-[85%] sm:max-w-[70%]">
                        <div
                          className={`p-3.5 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed shadow-xs ${
                            msg.isMine
                              ? "bg-slate-900 text-white rounded-br-xs"
                              : "bg-white text-slate-900 border border-slate-200 rounded-bl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-1 px-1 font-medium">
                        <span>{formatTime(msg.createdAt)}</span>
                        {msg.isMine && (
                          <CheckCheck
                            className={`w-3.5 h-3.5 ${
                              msg.readAt ? "text-blue-600" : "text-slate-300"
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Box */}
              <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
                {error && (
                  <div className="mb-2 p-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center justify-between">
                    <span>{error}</span>
                    <button
                      onClick={() => setError(null)}
                      className="text-red-500 hover:text-red-700 font-black text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Type a message (e.g., I have arrived at the gate)..."
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    maxLength={2000}
                    disabled={isSending}
                    className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none focus:border-blue-600"
                    id="chat-message-input"
                    name="messageText"
                    aria-label="Message content"
                  />
                  <button
                    type="submit"
                    disabled={!newMessageText.trim() || isSending}
                    className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-md shadow-orange-600/20 flex items-center space-x-1.5 shrink-0"
                    aria-label="Send message"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span className="hidden sm:inline">Send</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 space-y-3">
              <div className="p-4 rounded-3xl bg-slate-100 text-slate-400">
                <MessageSquare className="w-10 h-10 stroke-[1.5]" />
              </div>
              <h2 className="text-base font-bold text-slate-800">
                Select a Conversation
              </h2>
              <p className="text-xs text-slate-500 text-center max-w-sm">
                Choose a conversation from the sidebar to chat with employers or assigned workers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
