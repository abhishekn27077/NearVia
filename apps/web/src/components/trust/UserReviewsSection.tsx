import React, { useEffect, useState } from "react";
import { RatingStars } from "./RatingStars";
import { Flag, MessageSquare } from "lucide-react";
import { ReportModal } from "../../features/safety";

interface ReviewItem {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  rating: number;
  comments: string;
  createdAt: string;
}

interface UserReviewsSectionProps {
  userId: string;
  className?: string;
}

export const UserReviewsSection: React.FC<UserReviewsSectionProps> = ({ userId, className }) => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingReview, setReportingReview] = useState<ReviewItem | null>(null);

  useEffect(() => {
    async function fetchReviews() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/reviews/users/${userId}/reviews`);
        const data = await res.json();
        if (res.ok && data.success) {
          setReviews(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchReviews();
    }
  }, [userId]);

  if (loading) {
    return <div className="text-xs text-slate-400 py-2">Loading feedback reviews...</div>;
  }

  if (reviews.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className || ""}`}>
      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span>Verified Shift Feedback ({reviews.length})</span>
      </div>

      <div className="space-y-2">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-white">{r.reviewerName}</span>
                <RatingStars rating={r.rating} />
              </div>

              <button
                onClick={() => setReportingReview(r)}
                title="Report inappropriate review"
                className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <Flag className="w-3 h-3" />
                <span>Report</span>
              </button>
            </div>

            {r.comments && <p className="text-xs text-slate-300 italic">"{r.comments}"</p>}

            <div className="text-[10px] text-slate-500">
              {new Date(r.createdAt).toLocaleDateString("en-IN")}
            </div>
          </div>
        ))}
      </div>

      {reportingReview && (
        <ReportModal
          isOpen={!!reportingReview}
          onClose={() => setReportingReview(null)}
          targetType="REVIEW"
          targetId={reportingReview.id}
          targetTitle={`Review by ${reportingReview.reviewerName}`}
        />
      )}
    </div>
  );
};
