/**
 * NEARVIA Notification Bell Component
 * Live in-app notification dropdown with real-time unread badge, mark as read, and direct navigation.
 */

import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Briefcase,
  UserCheck,
  MapPin,
  IndianRupee,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { webConfig } from "../../config";
import { supabase } from "../../lib/supabaseClient";

interface NotificationItem {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/notifications?limit=15`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data?.items || []);
        setUnreadCount(json.data?.unreadCount || 0);
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user?.id) return;

    // Supabase Realtime Channel
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        },
      )
      .subscribe();

    // 15s fallback polling for network resilience
    const interval = setInterval(fetchNotifications, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [token, user?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${webConfig.apiBaseUrl}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Offline
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      await fetch(`${webConfig.apiBaseUrl}/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Offline
    } finally {
      setIsLoading(false);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return "";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "APPLICATION_RECEIVED":
      case "APPLICATION_SUBMITTED":
        return <Briefcase className="w-4 h-4 text-blue-600" />;
      case "WORKER_HIRED":
      case "APPLICATION_ACCEPTED":
        return <UserCheck className="w-4 h-4 text-emerald-600" />;
      case "SHIFT_CHECKED_IN":
      case "CHECKED_IN":
        return <MapPin className="w-4 h-4 text-amber-600" />;
      case "PAYMENT_RELEASED":
      case "PAYMENT_ESCROWED":
        return <IndianRupee className="w-4 h-4 text-purple-600" />;
      case "DISPUTE_FILED":
      case "SAFETY_ALERT":
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const navigate = useNavigate();

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.isRead) handleMarkAsRead(n.id);
    setIsOpen(false);

    if (n.type === "NEW_MESSAGE" || n.data?.conversationId) {
      if (n.data?.conversationId) {
        navigate(`/messages/${n.data.conversationId}`);
      } else {
        navigate("/messages");
      }
      return;
    }

    if (n.data?.assignmentId) {
      if (user?.role === "PROVIDER") {
        navigate(`/provider/shifts/${n.data.assignmentId}`);
      } else {
        navigate(`/worker/shifts/${n.data.assignmentId}`);
      }
      return;
    }

    if (n.data?.workOpportunityId) {
      if (user?.role === "PROVIDER") {
        if (n.type === "NEW_APPLICATION") {
          navigate(`/provider/jobs/${n.data.workOpportunityId}/applicants`);
        } else {
          navigate(`/provider/jobs/${n.data.workOpportunityId}`);
        }
      } else {
        navigate("/worker/applications");
      }
      return;
    }

    if (n.type?.includes("DISPUTE") || n.type?.includes("REPORT")) {
      navigate("/disputes");
      return;
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) fetchNotifications();
        }}
        aria-label={t.notifications}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 min-h-[40px] min-w-[40px]"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white border border-slate-200 shadow-float z-50 overflow-hidden animate-scale-up text-slate-900">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm text-slate-900 font-display">
                {t.notifications}
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
                  {unreadCount} {t.unread}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1 focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg p-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t.markAllAsRead}</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-slate-400">
                <Bell className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-600">{t.noNotifications}</p>
                <p className="text-[11px] text-slate-400">
                  Updates about shifts, applications, and payouts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 transition-colors flex items-start space-x-3 cursor-pointer ${
                    n.isRead
                      ? "bg-white hover:bg-slate-50 text-slate-600"
                      : "bg-blue-50/40 hover:bg-blue-50/70 text-slate-900"
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs shrink-0">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs truncate ${
                          n.isRead ? "font-bold text-slate-800" : "font-black text-slate-900"
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-1">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
            <Link
              to={user.role === "PROVIDER" ? "/provider/dashboard" : "/worker/dashboard"}
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors inline-flex items-center space-x-1 p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span>{t.dashboard}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
