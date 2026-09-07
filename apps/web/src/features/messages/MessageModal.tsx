/**
 * MessageModal Component
 * Floating/modal quick-chat interface to initiate or continue conversations
 * directly from shift cards, applicant drawers, and assignments.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  MessageSquare,
  Loader2,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { supabase } from "../../lib/supabaseClient";
import { ConversationItem, MessageItem } from "./types";

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOpportunityId: string;
  opportunityTitle: string;
  counterpartyName: string;
  targetWorkerUserId?: string;
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  workOpportunityId,
  opportunityTitle,
  counterpartyName,
  targetWorkerUserId,
}) => {
  const { token, user } = useAuth();
  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessageText, setNewMessageText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initialize or fetch conversation
  useEffect(() => {
    if (!isOpen || !token || !workOpportunityId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const initConversation = async () => {
      try {
        const res = await fetch(`${webConfig.apiBaseUrl}/messages/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workOpportunityId,
            workerUserId: targetWorkerUserId,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setConversation(json.data);
            // Fetch messages
            const msgRes = await fetch(
              `${webConfig.apiBaseUrl}/messages/conversations/${json.data.id}/messages`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (msgRes.ok) {
              const msgJson = await msgRes.json();
              setMessages(msgJson.data || []);
            }
          }
        } else {
          const errJson = await res.json();
          if (isMounted) {
            setError(errJson.message || "Failed to initialize conversation.");
          }
        }
      } catch {
        if (isMounted) {
          setError("Network error while connecting to chat.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initConversation();

    return () => {
      isMounted = false;
    };
  }, [isOpen, workOpportunityId, targetWorkerUserId, token]);

  // Realtime subscription for this conversation
  useEffect(() => {
    if (!conversation?.id || !isOpen) return;

    const channel = supabase
      .channel(`modal-chat-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [
                ...prev,
                {
                  id: newMsg.id,
                  conversationId: newMsg.conversation_id,
                  senderId: newMsg.sender_id,
                  senderName: newMsg.sender_id === user?.id ? "You" : counterpartyName,
                  recipientId: newMsg.recipient_id,
                  content: newMsg.content,
                  isMine: newMsg.sender_id === user?.id,
                  readAt: newMsg.read_at,
                  createdAt: newMsg.created_at,
                },
              ];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, isOpen, user?.id, counterpartyName]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !conversation?.id || isSending) return;

    const textToSend = newMessageText.trim();
    setNewMessageText("");
    setIsSending(true);

    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/messages/conversations/${conversation.id}/messages`,
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
        const sentMsg: MessageItem = json.data;
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
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

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[580px] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
              {counterpartyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {counterpartyName}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[240px]">
                {opportunityTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {conversation && (
              <Link
                to={`/messages/${conversation.id}`}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 text-xs transition-colors"
                title="Open full screen chat"
                aria-label="Open full screen chat"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 text-xs transition-colors"
              aria-label="Close chat modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Opening secure channel...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 text-xs space-y-2">
              <p className="font-bold">{error}</p>
              <p className="text-slate-500">
                Only candidates with active applications or assignments can be messaged.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center space-y-2 p-6">
              <MessageSquare className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">
                Direct Work Site Chat
              </p>
              <p className="text-[11px] text-slate-500">
                Coordinate shift details, gate entry, or arrival timings securely.
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
                <div
                  className={`p-3 rounded-2xl text-xs font-medium max-w-[80%] leading-relaxed ${
                    msg.isMine
                      ? "bg-slate-900 text-white rounded-br-xs"
                      : "bg-white text-slate-900 border border-slate-200 rounded-bl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <div className="flex items-center space-x-1 text-[9px] text-slate-400 mt-1 px-1">
                  <span>{formatTime(msg.createdAt)}</span>
                  {msg.isMine && (
                    <CheckCheck
                      className={`w-3 h-3 ${
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

        {/* Input Footer */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type message..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              disabled={isLoading || isSending || !!error}
              maxLength={2000}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
              id="modal-chat-input"
              name="modalMessage"
              aria-label="Modal message input"
            />
            <button
              type="submit"
              disabled={!newMessageText.trim() || isSending || !!error}
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs flex items-center space-x-1 shrink-0"
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
