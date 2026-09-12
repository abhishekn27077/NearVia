import { useEffect, useState } from "react";
import { TrustBadge } from "./TrustBadge";
import { RatingStars } from "./RatingStars";
import { Award } from "lucide-react";

interface TrustProfileData {
  id: string;
  role: string;
  fullName: string;
  averageRating: number | null;
  totalRatingsCount: number;
  hasRatingHistory: boolean;
  completedTasksCount: number;
  completedJobs: number;
  completionRate: number | null;
  reliabilityScore: number | null;
  reputationStatus: "NEW" | "ESTABLISHED" | "VETERAN";
  verified: boolean;
  skills?: string[];
  avatarUrl?: string;
}

interface TrustProfileViewProps {
  userId: string;
  className?: string;
}

export function TrustProfileView({ userId, className }: TrustProfileViewProps) {
  const [profile, setProfile] = useState<TrustProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrustProfile() {
      try {
        setLoading(true);
        const token = localStorage.getItem("nearvia_auth_token");
        const res = await fetch(`/api/v1/users/${userId}/trust`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to load trust profile");
        }
        setProfile(data.data);
      } catch (err: any) {
        setError(err.message || "Failed to load trust profile");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchTrustProfile();
    }
  }, [userId]);

  if (loading) {
    return <div className="animate-pulse h-24 bg-slate-100 rounded-2xl"></div>;
  }

  if (error || !profile) {
    return <div className="text-xs text-slate-400">Reputation profile not available.</div>;
  }

  return (
    <div className={`p-4 border border-slate-200/80 rounded-2xl bg-white shadow-xs space-y-3 ${className || ""}`}>
      <div className="flex items-start space-x-3.5">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
          ) : (
            <span>{profile.fullName?.charAt(0) || "U"}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900 truncate">{profile.fullName}</h3>
            <TrustBadge status={profile.verified ? "VERIFIED" : "UNVERIFIED"} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {profile.hasRatingHistory && profile.averageRating !== null ? (
              <RatingStars rating={profile.averageRating} count={profile.totalRatingsCount} />
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]">
                ★ New to NearVia
              </span>
            )}

            {profile.reputationStatus === "VETERAN" && (
              <span className="inline-flex items-center text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                <Award className="w-3 h-3 mr-1 text-amber-600" />
                Veteran Partner
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Authoritative Reliability & Fulfillment Signals */}
      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Completed</span>
          <span className="font-black text-slate-900 text-sm">
            {profile.completedTasksCount || profile.completedJobs || 0}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Completion</span>
          <span className="font-black text-emerald-600 text-sm">
            {profile.completionRate !== null ? `${profile.completionRate}%` : "—"}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Reliability</span>
          <span className="font-black text-slate-900 text-sm">
            {profile.reliabilityScore !== null ? `${profile.reliabilityScore}%` : "New"}
          </span>
        </div>
      </div>

      {/* Skills / Badges if present */}
      {profile.skills && profile.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {profile.skills.slice(0, 4).map((skill, idx) => (
            <span
              key={idx}
              className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
