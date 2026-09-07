import React, { useState } from "react";
import { Sparkles, Mic, ArrowRight, CheckCircle, AlertCircle, RefreshCw, X, HelpCircle } from "lucide-react";
import { NLJobParseResult } from "@nearvia/types";

interface SmartJobDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDraft: (draft: NLJobParseResult) => void;
}

export const SmartJobDraftModal: React.FC<SmartJobDraftModalProps> = ({
  isOpen,
  onClose,
  onApplyDraft,
}) => {
  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<NLJobParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  if (!isOpen) return null;

  const quickPrompts = [
    "Need 2 helpers for sweet box packing tomorrow from 9am to 5pm in Jayanagar, ₹800/day",
    "Kal subah 10 baje se 4 baje tak catering cook chahiye Shivajinagar me 750 rupay",
    "Urgent electrician required for switchboard and wiring fix today in Indiranagar, ₹500 fixed",
    "Housekeeping and floor cleaning helper needed from 8am to 2pm in Koramangala, ₹650",
  ];

  const handleParse = async (textToParse?: string) => {
    const text = textToParse || inputText;
    if (!text.trim()) {
      setErrorMessage("Please enter a description or select an example prompt.");
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/v1/intelligence/jobs/parse-nl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not parse job description.");
      }

      setParseResult(data.data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to auto-draft job.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your description.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;

    setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      setIsListening(false);
      handleParse(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Smart Natural-Language Job Drafter</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Type or speak in English or Hinglish to automatically fill the entire job posting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Job Description (Colloquial / Free Text)
          </label>
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Need 2 helpers for sweet box packing tomorrow from 9am to 5pm in Jayanagar, ₹800 per day..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition resize-none"
            />
            <button
              onClick={handleVoiceInput}
              title="Speak description"
              type="button"
              className={`absolute right-3 bottom-3 p-2 rounded-lg transition ${
                isListening
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600"
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
              Quick examples (click to test):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInputText(p);
                    handleParse(p);
                  }}
                  className="text-xs text-left bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 transition truncate max-w-xs"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => handleParse()}
              disabled={isParsing || !inputText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 transition"
            >
              {isParsing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing Text...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Auto-Draft Form
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Extracted Structured Results Preview */}
        {parseResult && (
          <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Extracted Intelligence ({Math.round(parseResult.confidence * 100)}% Confidence)
                </span>
              </div>
              <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-medium">
                {parseResult.detectedLanguage}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-400 block">Job Title:</span>
                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                  {parseResult.title}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Category:</span>
                <span className="font-semibold">{parseResult.categoryName || "General"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Offered Wage:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ₹{parseResult.suggestedWage} ({parseResult.paymentType})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Date & Shift:</span>
                <span className="font-semibold">
                  {parseResult.workDate} ({parseResult.durationHours}h)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Start - End Time:</span>
                <span className="font-semibold">
                  {parseResult.startTime.slice(0, 5)} - {parseResult.endTime.slice(0, 5)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Work Type:</span>
                <span className="font-semibold">{parseResult.workType}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Urgency:</span>
                <span className="font-semibold">{parseResult.urgency}</span>
              </div>
            </div>

            {parseResult.requiredSkills.length > 0 && (
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Extracted Trade Skills:</span>
                <div className="flex flex-wrap gap-1.5">
                  {parseResult.requiredSkills.map((s, i) => (
                    <span
                      key={i}
                      className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md font-medium"
                    >
                      ✓ {s.skillName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist Preview */}
            {parseResult.responsibilities.length > 0 && (
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Key Responsibilities:</span>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
                  {parseResult.responsibilities.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Fields Notice */}
            {parseResult.missingFields.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Missing Information: </span>
                  {parseResult.clarificationsNeeded.join(" ")}
                </div>
              </div>
            )}

            {/* Action */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  onApplyDraft(parseResult);
                  onClose();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 transition"
              >
                <span>Populate Job Form</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
