import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import {
  WorkType,
  UrgencyLevel,
  PaymentType,
  Category,
  WorkOpportunityDetail,
} from "@nearvia/types";

export const EditWorkOpportunityPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);

  // Form Fields
  const [workType, setWorkType] = useState<WorkType>(WorkType.TASK);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [workersNeeded, setWorkersNeeded] = useState<number>(1);
  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [durationHours, setDurationHours] = useState<number>(2);
  const [addressApproximate, setAddressApproximate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">(500);
  const [paymentType, setPaymentType] = useState<PaymentType>(
    PaymentType.FIXED,
  );
  const [urgency, setUrgency] = useState<UrgencyLevel>(UrgencyLevel.NORMAL);
  const [responsibilities, setResponsibilities] = useState("");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (id) {
      loadInitialData(id);
    }
  }, [id, token]);

  const loadInitialData = async (oppId: string) => {
    setIsLoading(true);
    try {
      const [catRes, oppRes] = await Promise.all([
        fetch(`${webConfig.apiBaseUrl}/categories`),
        fetch(`${webConfig.apiBaseUrl}/work-opportunities/${oppId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (catRes.ok) {
        const catJson = await catRes.json();
        setCategories(catJson.data || []);
      }

      if (oppRes.ok) {
        const oppJson = await oppRes.json();
        const data: WorkOpportunityDetail = oppJson.data;
        setWorkType(data.workType);
        setTitle(data.title);
        setCategoryId(data.categoryId);
        setDescription(data.description);
        setWorkersNeeded(data.workersNeeded);
        setWorkDate(data.workDate);
        setStartTime(data.startTime);
        setEndTime(data.endTime);
        setDurationHours(data.durationHours);
        setAddressApproximate(data.addressApproximate);
        setPaymentAmount(data.paymentAmount);
        setPaymentType(data.paymentType);
        setUrgency(data.urgency);
        setResponsibilities(data.responsibilities || "");
        setInstructions(data.instructions || "");
      }
    } catch {
      // Demo mock fallback
      setTitle("Shift 20 boxes to first-floor warehouse storage");
      setDescription("Need assistance moving packed cartons.");
      setWorkDate("2026-08-26");
      setAddressApproximate("MG Road Metro Station");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSaving(true);
    setFeedback(null);

    const payload = {
      workType,
      title,
      categoryId,
      description,
      urgency,
      workersNeeded: Number(workersNeeded),
      addressApproximate,
      workDate,
      startTime,
      endTime,
      durationHours: Number(durationHours),
      paymentAmount: Number(paymentAmount),
      paymentType,
      responsibilities: responsibilities || null,
      instructions: instructions || null,
    };

    try {
      const res = await fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        navigate(`/provider/work/${id}`);
      } else {
        const err = await res.json();
        setFeedback({
          type: "error",
          message: err.error?.message || "Failed to update draft.",
        });
      }
    } catch {
      navigate(`/provider/work/${id}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm animate-pulse">
        Loading draft opportunity...
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link
          to={`/provider/work/${id}`}
          className="inline-flex items-center space-x-1 text-xs text-emerald-400 hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Opportunity Details</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          Edit Draft Opportunity
        </h1>
      </div>

      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs flex items-center space-x-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="p-6 sm:p-8 rounded-3xl bg-slate-800/60 border border-slate-700/80 space-y-6"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Work Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Work Type
            </label>
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value as WorkType)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm"
            >
              <option value={WorkType.TASK}>TASK (1-3 Hours)</option>
              <option value={WorkType.SHIFT}>SHIFT (4-8 Hours)</option>
              <option value={WorkType.JOB}>JOB (1+ Days)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Description
          </label>
          <textarea
            rows={4}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Workers Needed
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={workersNeeded}
              onChange={(e) => setWorkersNeeded(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Wage Amount (₹)
            </label>
            <input
              type="number"
              min="50"
              value={paymentAmount}
              onChange={(e) =>
                setPaymentAmount(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Urgency
            </label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm"
            >
              <option value={UrgencyLevel.NORMAL}>Normal</option>
              <option value={UrgencyLevel.URGENT}>Urgent</option>
              <option value={UrgencyLevel.IMMEDIATE}>Immediate</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700/80">
          <button
            type="button"
            onClick={() => navigate(`/provider/work/${id}`)}
            className="py-3 px-5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving Changes..." : "Save Draft Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
