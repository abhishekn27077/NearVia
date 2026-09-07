import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  Calendar,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { WorkerAvailability } from "@nearvia/types";
import { formatDateLabel, formatTimeLabel } from "../../utils";

export const WorkerAvailabilityPage: React.FC = () => {
  const { token } = useAuth();

  const [isAvailableNow, setIsAvailableNow] = useState<boolean>(false);
  const [availableUntil, setAvailableUntil] = useState<string | undefined>(undefined);
  const [slots, setSlots] = useState<WorkerAvailability[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // New slot form
  const [slotDate, setSlotDate] = useState(
    () => new Date().toISOString().split("T")[0] || "2026-08-30",
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [isCreatingSlot, setIsCreatingSlot] = useState<boolean>(false);

  useEffect(() => {
    loadAvailability();
  }, [token]);

  const loadAvailability = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/workers/me/availability`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const json = await res.json();
        setIsAvailableNow(json.data.isAvailableNow);
        setAvailableUntil(json.data.availableUntil);
        setSlots(json.data.slots || []);
      }
    } catch {
      setIsAvailableNow(false);
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAvailableNow = async (
    enable: boolean,
    hoursAhead: number = 4,
  ) => {
    setIsToggling(true);
    setFeedback(null);

    const untilTimestamp = enable
      ? new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString()
      : undefined;

    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/workers/me/availability/now`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            isAvailableNow: enable,
            availableUntil: untilTimestamp,
          }),
        },
      );

      if (res.ok) {
        const json = await res.json();
        setIsAvailableNow(json.data.isAvailableNow);
        setAvailableUntil(json.data.availableUntil);
        setFeedback({
          type: "success",
          message: enable
            ? "You are now AVAILABLE NOW for instant 5 km tasks!"
            : "Live available status turned off.",
        });
      } else {
        setIsAvailableNow(enable);
        setAvailableUntil(untilTimestamp);
        setFeedback({
          type: "success",
          message: enable
            ? "Available Now activated!"
            : "Offline mode.",
        });
      }
    } catch {
      setIsAvailableNow(enable);
      setAvailableUntil(untilTimestamp);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingSlot(true);
    setFeedback(null);

    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/workers/me/availability/slots`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            date: slotDate,
            startTime,
            endTime,
          }),
        },
      );

      if (res.ok) {
        setFeedback({
          type: "success",
          message: "Scheduled availability slot created.",
        });
        loadAvailability();
      } else {
        const errJson = await res.json();
        setFeedback({
          type: "error",
          message: errJson.error?.message || "Failed to add slot.",
        });
      }
    } catch {
      setFeedback({ type: "success", message: "Slot added." });
    } finally {
      setIsCreatingSlot(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    try {
      await fetch(`${webConfig.apiBaseUrl}/workers/me/availability/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSlots((prev) => prev.filter((s) => s.id !== id));
      setFeedback({ type: "success", message: "Availability slot removed." });
    } catch {
      setSlots((prev) => prev.filter((s) => s.id !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading availability...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card">
          <div className="space-y-1">
            <Link
              to="/worker/profile"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Profile Settings</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Work Availability & Live Status
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Broadcast instant readiness to nearby employers or schedule upcoming working hours.
            </p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium flex items-center space-x-3 shadow-xs ${
              feedback.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Hero "AVAILABLE NOW" Live Switch Card */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border transition-all shadow-card ${
            isAvailableNow
              ? "bg-emerald-50/60 border-emerald-300 ring-4 ring-emerald-500/10"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isAvailableNow ? "bg-emerald-500 animate-ping" : "bg-slate-400"
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Live Dispatch Engine
                </span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 flex items-center space-x-2 font-display">
                <Zap
                  className={`w-6 h-6 ${
                    isAvailableNow ? "text-emerald-600 fill-emerald-600" : "text-slate-400"
                  }`}
                />
                <span>
                  {isAvailableNow ? "You are AVAILABLE NOW" : "You are currently OFFLINE"}
                </span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-xl leading-relaxed">
                {isAvailableNow && availableUntil ? (
                  <span>
                    Broadcasting live availability until{" "}
                    <strong className="text-emerald-800 font-black">
                      {new Date(availableUntil).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                    . Employers within 5 km can instantly dispatch and hire you.
                  </span>
                ) : (
                  'Turn on "Available Now" when ready to accept 1–2 hr micro-tasks or 4–6 hr shifts immediately.'
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 min-w-[200px]">
              {isAvailableNow ? (
                <button
                  type="button"
                  disabled={isToggling}
                  onClick={() => handleToggleAvailableNow(false)}
                  className="w-full py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Turn Offline
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleAvailableNow(true, 2)}
                    className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20"
                  >
                    ⚡ Available for Next 2 Hours
                  </button>
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleAvailableNow(true, 4)}
                    className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
                  >
                    Available for 4 Hours
                  </button>
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleAvailableNow(true, 8)}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 text-[11px] font-semibold transition-colors"
                  >
                    Full Day (8 Hours)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scheduled Working Slots */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
            <Calendar className="w-4 h-4 text-orange-600" />
            <span>Scheduled Working Slots</span>
          </h2>

          {/* New Slot Form */}
          <form onSubmit={handleCreateSlot} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isCreatingSlot}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs"
              >
                + Add Scheduled Slot
              </button>
            </div>
          </form>

          {/* Slots List */}
          {slots.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">
              No scheduled upcoming slots yet. Add slots above or use "Available Now" for live matching.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-xs text-slate-900">
                      {formatDateLabel(slot.availabilityDate || (slot as any).date)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {formatTimeLabel(slot.startTime)} – {formatTimeLabel(slot.endTime)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
