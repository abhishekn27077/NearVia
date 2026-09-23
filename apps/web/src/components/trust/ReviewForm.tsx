import React, { useState } from "react";
import { Star, MessageSquare, CheckCircle2 } from "lucide-react";
import { apiFetch } from "../../utils/apiClient";

interface ReviewFormProps {
  assignmentId: string;
  onSuccess?: () => void;
  className?: string;
}

export function ReviewForm({ assignmentId, onSuccess, className }: ReviewFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating between 1 and 5.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/reviews/assignments/${assignmentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          comments: comments.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.status === 409 || data.error?.message?.toLowerCase().includes("already reviewed")) {
        setAlreadyReviewed(true);
        setSuccess(true);
        if (onSuccess) onSuccess();
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to submit review.");
      }

      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center ${className || ""}`}>
        <div className="mx-auto w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <h4 className="font-extrabold text-emerald-900 text-sm">
          {alreadyReviewed ? "Review Already Submitted" : "Review Submitted Successfully"}
        </h4>
        <p className="text-xs text-emerald-700 mt-1">
          {alreadyReviewed
            ? "Your feedback is already recorded for this completed assignment."
            : "Thank you! Your feedback helps build trust in the NearVia community."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 ${className || ""}`}>
      <div>
        <h4 className="text-sm font-black text-slate-900 flex items-center space-x-2 font-display">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>Leave a Review</span>
        </h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Rate your counterpart to update their verified community reliability score.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Rating (1 to 5 Stars) *
        </label>
        <div className="flex items-center space-x-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRating(value);
                setError(null);
              }}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110 focus:outline-none cursor-pointer"
              title={`${value} Star${value > 1 ? "s" : ""}`}
            >
              <Star
                className={`w-7 h-7 ${
                  value <= (hoverRating || rating)
                    ? "text-amber-400 fill-amber-400"
                    : "text-slate-200"
                } transition-colors`}
              />
            </button>
          ))}
          <span className="text-xs font-extrabold text-slate-600 ml-2">
            {rating > 0 ? `${rating} / 5 Stars` : "Select a rating"}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
          <MessageSquare className="w-3.5 h-3.5 mr-1 text-slate-400" />
          Comments (Optional)
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Describe your working experience, punctuality, and job quality..."
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs text-slate-900"
        />
      </div>

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
      >
        {loading ? "Submitting Review..." : "Submit Review"}
      </button>
    </form>
  );
}
