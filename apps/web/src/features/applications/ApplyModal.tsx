import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Send,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  Clock,
  MapPin,
  UserCheck,
} from "lucide-react";
import { DiscoveredOpportunity, GeoCoordinates } from "@nearvia/types";
import { triggerCelebration } from "../../components/ui/Confetti";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { formatDateLabel, formatTimeLabel } from "../../utils";

interface ApplyModalProps {
  opportunity:
    | DiscoveredOpportunity
    | {
        id: string;
        title: string;
        workType: string;
        paymentAmount: number;
        paymentType: string;
        workDate: string;
        startTime?: string;
        endTime?: string;
        addressApproximate: string;
        match?: { score: number };
      };
  isOpen: boolean;
  userLocation?: GeoCoordinates;
  onClose: () => void;
  onSuccess: (applicationId: string) => void;
}

export const ApplyModal: React.FC<ApplyModalProps> = ({
  opportunity,
  isOpen,
  userLocation,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [workerNotes, setWorkerNotes] = useState("");
  const [proposedWage, setProposedWage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/${opportunity.id}/applications`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            workerNotes: workerNotes.trim() ? workerNotes.trim() : undefined,
            proposedWage: proposedWage ? Number(proposedWage) : undefined,
            workerLatitude: userLocation?.latitude,
            workerLongitude: userLocation?.longitude,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error?.message ||
            "Failed to submit application. Please make sure you are signed in.",
        );
      }

      setIsSuccess(true);
      triggerCelebration();
      setTimeout(() => {
        onSuccess(data.data.id);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Error submitting application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = formatDateLabel(opportunity.workDate);
  const formattedTime = opportunity.startTime
    ? ` • ${formatTimeLabel(opportunity.startTime)}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-float space-y-5 relative overflow-hidden text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-100">
                1-Click Apply
              </span>
              {opportunity.match && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>{opportunity.match.score}% Match</span>
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 line-clamp-1">
              {opportunity.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Opportunity Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-700">
            <div className="flex items-center space-x-1.5">
              <IndianRupee className="w-4 h-4 text-emerald-600" />
              <span className="text-base font-black text-slate-900 font-mono">
                ₹{opportunity.paymentAmount}
              </span>
              <span className="text-slate-500 font-semibold">
                ({opportunity.paymentType})
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {formattedDate}
                {formattedTime}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-500 truncate">
            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{opportunity.addressApproximate}</span>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {!token ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
              <UserCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-base font-black text-slate-900 font-display">
                Sign in to Apply for this Work
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Create a free worker profile with your trade skills or log in with your phone to apply in 1-click.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <Link
                to={`/login?redirect=/find-work?selected=${opportunity.id}`}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 transition-all"
              >
                Log In / Register
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="py-6 text-center space-y-2 animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              Application Submitted!
            </h3>
            <p className="text-xs text-slate-500">
              The employer has been notified and will confirm shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Optional Worker Note */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Note for Employer (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="E.g. I live 1 km away, have 2 years kitchen experience, and can start immediately..."
                value={workerNotes}
                onChange={(e) => setWorkerNotes(e.target.value)}
                className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Optional Wage Negotiation */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Proposed Wage (Optional, Default: ₹{opportunity.paymentAmount})
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  placeholder={opportunity.paymentAmount.toString()}
                  value={proposedWage}
                  onChange={(e) => setProposedWage(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-bold font-mono"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold flex items-center space-x-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm Application</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
