import React, { useState } from "react";
import {
  ShieldAlert,
  PhoneCall,
  Share2,
  AlertTriangle,
  MessageSquare,
  X,
  Copy,
  Check,
} from "lucide-react";
import { AssignmentDetail } from "@nearvia/types";
import { ReportModal } from "../safety/ReportModal";

interface SafetyToolkitModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: AssignmentDetail;
  onOpenChat: () => void;
}

export const SafetyToolkitModal: React.FC<SafetyToolkitModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onOpenChat,
}) => {
  const [copied, setCopied] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/share/job/${assignment.id}`;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl space-y-5 p-6 sm:p-7 border border-slate-100 animate-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 font-display">
                  Worker Safety & Support Toolkit
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  On-shift emergency assistance & trust controls
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Critical Emergency Banner (SOS) */}
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
            <div className="flex items-start space-x-3">
              <PhoneCall className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                  National Emergency SOS (Dial 112)
                </h4>
                <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                  If you are in immediate danger, dial 112 (Police / Medical / Fire) directly. 
                  <strong className="block text-[10px] text-rose-950 mt-0.5">
                    * NEARVIA is a software platform and cannot dispatch armed or first-responder emergency units.
                  </strong>
                </p>
              </div>
            </div>

            <a
              href="tel:112"
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-md shadow-rose-600/30 transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>🚨 Dial 112 Emergency Services Now</span>
            </a>
          </div>

          {/* Action Grid */}
          <div className="space-y-2.5">
            {/* Share Active Job */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-black text-slate-900">
                    Share Active Job with Family / Friends
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  Privacy Safe
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Shares a secure live link showing shift status and general locality (zero phone numbers or exact private GPS).
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 shadow-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            {/* In-Shift Communication & Support */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChat();
                }}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-all group"
              >
                <MessageSquare className="w-4 h-4 text-blue-600 mb-1" />
                <div className="text-xs font-black text-slate-900">Message Employer</div>
                <div className="text-[10px] text-slate-500">In-app documented chat</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsReportOpen(true);
                }}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition-all group"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 mb-1" />
                <div className="text-xs font-black text-slate-900">Report Safety Issue</div>
                <div className="text-[10px] text-slate-500">Flag to Trust & Safety</div>
              </button>
            </div>
          </div>

          <div className="pt-2 text-center">
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Close Safety Toolkit
            </button>
          </div>
        </div>
      </div>

      {/* Report Modal Integration */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="ASSIGNMENT"
        targetId={assignment.id}
        targetTitle={`Shift: ${assignment.opportunityTitle}`}
      />
    </>
  );
};
