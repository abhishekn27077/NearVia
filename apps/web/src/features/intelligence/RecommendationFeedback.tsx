import React, { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Check, X, Sparkles } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export interface RecommendationFeedbackProps {
  recommendationId: string;
  type: "WORKER" | "PROVIDER";
  onFeedbackGiven?: (useful: boolean, reason?: string) => void;
  className?: string;
}

const WORKER_REASONS = [
  "Too far",
  "Wrong skill",
  "Wrong time",
  "Low pay",
  "Not interested",
  "Other",
] as const;

const PROVIDER_REASONS = [
  "Skills mismatch",
  "Too far",
  "Unavailable",
  "Low experience",
  "Other",
] as const;

export const RecommendationFeedback: React.FC<RecommendationFeedbackProps> = ({
  recommendationId,
  type,
  onFeedbackGiven,
  className = "",
}) => {
  const { language } = useLanguage();
  const storageKey = `nearvia_feedback_${type}_${recommendationId}`;

  const [hasFeedback, setHasFeedback] = useState<boolean>(false);
  const [selectedUseful, setSelectedUseful] = useState<boolean | null>(null);
  const [showReasons, setShowReasons] = useState<boolean>(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setHasFeedback(true);
        setSelectedUseful(parsed.useful);
        setSelectedReason(parsed.reason || null);
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  if (isDismissed) return null;

  const handleSelectUseful = (useful: boolean) => {
    setSelectedUseful(useful);
    if (useful) {
      // Save positive feedback immediately
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ useful: true, timestamp: new Date().toISOString() })
        );
      } catch {}
      setHasFeedback(true);
      setShowReasons(false);
      onFeedbackGiven?.(true);
    } else {
      // Show reasons for negative feedback
      setShowReasons(true);
    }
  };

  const handleSelectReason = (reason: string) => {
    setSelectedReason(reason);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          useful: false,
          reason,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {}
    setHasFeedback(true);
    setShowReasons(false);
    onFeedbackGiven?.(false, reason);
  };

  const reasons = type === "WORKER" ? WORKER_REASONS : PROVIDER_REASONS;

  // Render localized prompt
  const promptText =
    type === "WORKER"
      ? language === "kn"
        ? "ಈ ಕೆಲಸದ ಹೊಂದಾಣಿಕೆ ಉಪಯುಕ್ತವಾಗಿದೆಯೇ?"
        : language === "hi"
        ? "क्या यह काम का सुझाव उपयोगी था?"
        : "Was this recommendation useful?"
      : "Was this candidate recommendation useful?";

  const thanksText =
    language === "kn"
      ? "ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಗೆ ಧನ್ಯವಾದಗಳು!"
      : language === "hi"
      ? "आपकी प्रतिक्रिया के लिए धन्यवाद!"
      : "Thanks for your feedback!";

  if (hasFeedback) {
    return (
      <div
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 font-medium ${className}`}
      >
        {selectedUseful ? (
          <Check className="w-3 h-3 text-emerald-600" />
        ) : (
          <ThumbsDown className="w-3 h-3 text-slate-400" />
        )}
        <span>{thanksText}</span>
        {selectedReason && (
          <span className="text-slate-400">({selectedReason})</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`p-2.5 sm:p-3 rounded-2xl bg-indigo-50/60 dark:bg-slate-800/50 border border-indigo-100 dark:border-slate-700/60 text-xs transition-all ${className}`}
    >
      {!showReasons ? (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{promptText}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => handleSelectUseful(true)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold transition-colors shadow-2xs"
            >
              <ThumbsUp className="w-3 h-3 text-emerald-600" />
              <span>{language === "kn" ? "ಹೌದು" : language === "hi" ? "हाँ" : "Yes"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectUseful(false)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold transition-colors shadow-2xs"
            >
              <ThumbsDown className="w-3 h-3 text-rose-500" />
              <span>{language === "kn" ? "ಇಲ್ಲ" : language === "hi" ? "नहीं" : "No"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Dismiss"
              aria-label="Dismiss feedback"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Why was this not useful?
            </span>
            <button
              type="button"
              onClick={() => setShowReasons(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => handleSelectReason(reason)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-600 text-[11px] font-medium transition-all"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
