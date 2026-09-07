import React, { useState } from "react";
import { Star, MessageSquare } from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/reviews/assignments/${assignmentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          rating,
          comments: comments.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to submit review");
      }
      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit review");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center ${className || ''}`}>
        <div className="mx-auto w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
          <Star className="w-5 h-5 text-emerald-600 fill-emerald-600" />
        </div>
        <h4 className="font-semibold text-emerald-800">Review Submitted</h4>
        <p className="text-sm text-emerald-600 mt-1">Thank you for sharing your feedback!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`p-4 rounded-xl bg-white border shadow-sm space-y-4 ${className || ''}`}>
      <div>
        <h4 className="font-semibold text-slate-900 flex items-center">
          <Star className="w-4 h-4 mr-1.5 text-slate-400" />
          Leave a Review
        </h4>
        <p className="text-xs text-slate-500 mt-1">
          Your feedback helps build trust in the community.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Rating</label>
        <div className="flex items-center space-x-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-colors focus:outline-none"
            >
              <Star
                className={`w-8 h-8 ${
                  value <= (hoverRating || rating)
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-slate-200"
                } transition-colors`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center">
          <MessageSquare className="w-4 h-4 mr-1.5 text-slate-400" />
          Comments (Optional)
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="How was your experience?"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
