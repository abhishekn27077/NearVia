import { useEffect, useState } from "react";
import { TrustBadge } from "./TrustBadge";
import { RatingStars } from "./RatingStars";


interface TrustProfileData {
  id: string;
  role: string;
  fullName: string;
  averageRating: number;
  totalRatingsCount: number;
  completedTasksCount: number;
  verified: boolean;
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
    return <div className="animate-pulse h-20 bg-slate-100 rounded-lg"></div>;
  }

  if (error || !profile) {
    return <div className="text-sm text-red-500">Could not load profile info.</div>;
  }

  return (
    <div className={`flex items-start space-x-4 p-4 border rounded-xl bg-white shadow-sm ${className || ''}`}>
      <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 font-medium text-lg">
            {profile.fullName.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{profile.fullName}</h3>
          <TrustBadge status={profile.verified ? "VERIFIED" : "UNVERIFIED"} />
        </div>
        <div className="mt-1 flex flex-col sm:flex-row sm:items-center text-sm text-slate-600 gap-2 sm:gap-4">
          <RatingStars rating={profile.averageRating} count={profile.totalRatingsCount} />
          {profile.role === "WORKER" && (
            <span className="flex items-center">
              <span className="font-medium mr-1">{profile.completedTasksCount}</span> tasks completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
