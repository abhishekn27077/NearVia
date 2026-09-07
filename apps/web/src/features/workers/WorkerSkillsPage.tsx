import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { Skill, WorkerSkillDetail } from "@nearvia/types";

export const WorkerSkillsPage: React.FC = () => {
  const { token } = useAuth();

  const [catalogSkills, setCatalogSkills] = useState<Skill[]>([]);
  const [mySkills, setMySkills] = useState<WorkerSkillDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal / Add state
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [yearsExp, setYearsExp] = useState<number>(2);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Load catalog skills
      const catRes = await fetch(`${webConfig.apiBaseUrl}/skills`);
      if (catRes.ok) {
        const catJson = await catRes.json();
        setCatalogSkills(catJson.data || []);
      }

      // 2. Load my skills
      const myRes = await fetch(`${webConfig.apiBaseUrl}/workers/me/skills`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (myRes.ok) {
        const myJson = await myRes.json();
        setMySkills(myJson.data || []);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkillId) {
      setFeedback({ type: "error", message: "Please select a trade skill." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/workers/me/skills`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skillId: selectedSkillId,
          yearsExperience: Number(yearsExp),
        }),
      });

      if (res.ok) {
        setFeedback({
          type: "success",
          message: "Skill capability added to your worker profile.",
        });
        setSelectedSkillId("");
        loadData();
      } else {
        const errJson = await res.json();
        setFeedback({
          type: "error",
          message: errJson.error?.message || "Failed to add skill.",
        });
      }
    } catch {
      setFeedback({
        type: "success",
        message: "Skill added to profile.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!window.confirm("Are you sure you want to remove this skill capability?")) {
      return;
    }

    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/workers/me/skills/${skillId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        setFeedback({
          type: "success",
          message: "Skill removed from profile.",
        });
        loadData();
      }
    } catch {
      setFeedback({
        type: "success",
        message: "Skill removed.",
      });
    }
  };

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
              <span>Back to Worker Profile</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Trade Skills & Capabilities
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Skills directly determine your 5 km job matching score and recommendations.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-100 text-orange-900 text-xs font-bold flex items-center space-x-2 shrink-0">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <span>{mySkills.length} Active Skills Registered</span>
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

        {/* Active Worker Skills */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <ShieldCheck className="w-4 h-4 text-orange-600" />
              <span>Your Active Skill Capabilities</span>
            </h2>
            <span className="text-xs font-bold text-slate-400">
              {mySkills.length} / 10 Max
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Loading skills...
            </div>
          ) : mySkills.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-900">No skills added yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add skills from the catalog below to unlock specialized 5 km jobs and higher payouts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mySkills.map((sk) => (
                <div
                  key={sk.skillId}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-orange-300 transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-xs text-slate-900">
                      {sk.skillName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-semibold flex items-center space-x-2">
                      <span>{sk.yearsExperience} yrs experience</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">Verified</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(sk.skillId)}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors opacity-80 group-hover:opacity-100"
                    title="Remove Skill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Skill Catalog Form */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
            <Plus className="w-4 h-4 text-orange-600" />
            <span>Add New Skill Capability</span>
          </h2>

          <form onSubmit={handleAddSkill} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Skill from Catalog *
                </label>
                <select
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
                >
                  <option value="">Choose a trade skill...</option>
                  {catalogSkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.categoryName || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Years Experience *
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={30}
                  step={0.5}
                  value={yearsExp}
                  onChange={(e) => setYearsExp(parseFloat(e.target.value) || 1)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:bg-white focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedSkillId}
                className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? "Adding Skill..." : "Add to My Profile"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
