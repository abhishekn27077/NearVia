import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserPlus,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  RefreshCw,
  Info,
  Compass,
} from "lucide-react";

interface WorkerRelationship {
  id: string;
  agentId: string;
  workerId: string;
  workerUserId: string;
  workerFullName: string;
  workerPhone: string;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  requestedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export const AgentDashboardPage: React.FC = () => {
  const [workers, setWorkers] = useState<WorkerRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "REVOKED">("ALL");

  // Connect worker state
  const [identifierType, setIdentifierType] = useState<"phone" | "id">("phone");
  const [inputVal, setInputVal] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch("/api/v1/agents/workers", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to load assisted workers");
      }
      setWorkers(data.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    if (!consentConfirmed) {
      setRequestError("You must confirm that the worker has given verbal or written consent.");
      return;
    }

    try {
      setRequesting(true);
      setRequestError(null);
      setRequestSuccess(null);

      const token = localStorage.getItem("nearvia_auth_token");
      const body =
        identifierType === "phone"
          ? { workerPhone: inputVal.trim(), consentConfirmed: true }
          : { workerId: inputVal.trim(), consentConfirmed: true };

      const res = await fetch("/api/v1/agents/workers/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to request worker access");
      }

      setRequestSuccess("Assistance request sent to worker. They will see it in their portal.");
      setInputVal("");
      setConsentConfirmed(false);
      fetchWorkers();
    } catch (err: any) {
      setRequestError(err.message || "Failed to request access");
    } finally {
      setRequesting(false);
    }
  };

  const handleRevokeWorker = async (workerId: string) => {
    if (!window.confirm("Are you sure you want to revoke assistance for this worker?")) return;
    try {
      setActionLoadingId(workerId);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/agents/workers/${workerId}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to revoke worker access");
      }
      fetchWorkers();
    } catch (err: any) {
      alert(err.message || "Error revoking access");
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeCount = workers.filter((w) => w.status === "ACTIVE").length;
  const pendingCount = workers.filter((w) => w.status === "PENDING").length;
  const revokedCount = workers.filter((w) => w.status === "REVOKED").length;

  const filteredWorkers = workers.filter((w) => {
    if (activeFilter === "ALL") return true;
    return w.status === activeFilter;
  });

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Community Agent Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Worker Support & Assistance Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Help local trade and manual workers discover opportunities, apply with consent, and manage their shifts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/radar"
              className="px-4 py-2.5 rounded-2xl bg-orange-600 text-white font-black text-xs hover:bg-orange-700 shadow-xs flex items-center space-x-1.5 transition-all"
            >
              <Compass className="w-4 h-4" />
              <span>Assisted Demand Radar</span>
            </Link>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center min-w-[90px]">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Active</div>
              <div className="text-xl font-black text-emerald-600 font-display">{activeCount}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100 text-center min-w-[90px]">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Pending</div>
              <div className="text-xl font-black text-amber-600 font-display">{pendingCount}</div>
            </div>
            {revokedCount > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center min-w-[90px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Revoked</div>
                <div className="text-xl font-black text-slate-500 font-display">{revokedCount}</div>
              </div>
            )}
          </div>
        </div>

        {/* Connect Worker Form */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <UserPlus className="w-4 h-4 text-orange-600" />
              <span>Connect & Support a Worker</span>
            </h2>
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIdentifierType("phone")}
                className={`px-3 py-1 rounded-lg transition ${
                  identifierType === "phone" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                By Phone
              </button>
              <button
                type="button"
                onClick={() => setIdentifierType("id")}
                className={`px-3 py-1 rounded-lg transition ${
                  identifierType === "id" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                By Worker ID
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Enter the worker's registered details to send an assistance authorization request. The worker must accept before you can assist them.
          </p>

          <form onSubmit={handleRequestAccess} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                {identifierType === "phone" ? (
                  <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                ) : (
                  <Users className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                )}
                <input
                  type={identifierType === "phone" ? "tel" : "text"}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder={identifierType === "phone" ? "+91 98765 43210" : "worker-uuid-here"}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm font-medium focus:bg-white focus:border-orange-500"
                />
              </div>
              <button
                type="submit"
                disabled={requesting || !inputVal.trim() || !consentConfirmed}
                className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
              >
                {requesting ? "Sending..." : "Send Request"}
              </button>
            </div>

            {/* Consent affirmation */}
            <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-100 flex items-start space-x-2">
              <input
                type="checkbox"
                id="agentConsentConfirmation"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="agentConsentConfirmation" className="text-xs text-slate-600 font-medium">
                <strong className="text-slate-800">Consent Confirmation:</strong> Worker has given permission to Agent to assist with NEARVIA.
              </label>
            </div>
          </form>

          {requestSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{requestSuccess}</span>
            </div>
          )}

          {requestError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{requestError}</span>
            </div>
          )}
        </div>

        {/* Worker Relationships List */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <Users className="w-4 h-4 text-orange-600" />
              <span>Worker Relationships ({filteredWorkers.length})</span>
            </h2>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {(["ALL", "ACTIVE", "PENDING", "REVOKED"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg transition capitalize ${
                    activeFilter === filter
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {filter.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Loading worker portfolio...
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">
              No workers found matching the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkers.map((w) => (
                <div
                  key={w.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-orange-300 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-800 font-black flex items-center justify-center text-sm">
                          {w.workerFullName?.charAt(0) || "W"}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-slate-900">{w.workerFullName}</div>
                          <div className="text-[11px] text-slate-500">{w.workerPhone}</div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {w.status === "ACTIVE" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : w.status === "PENDING" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Pending
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                          Revoked
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-0.5">
                      <div>Requested: {new Date(w.requestedAt).toLocaleDateString()}</div>
                      {w.acceptedAt && <div>Accepted: {new Date(w.acceptedAt).toLocaleDateString()}</div>}
                      {w.revokedAt && <div>Revoked: {new Date(w.revokedAt).toLocaleDateString()}</div>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 space-y-2">
                    {w.status === "ACTIVE" ? (
                      <>
                        <Link
                          to={`/agent/workers/${w.workerId}/find-work`}
                          className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center justify-center space-x-1 shadow-xs"
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>Find Jobs for Worker</span>
                        </Link>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/agent/workers/${w.workerId}`}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition text-center"
                          >
                            Details & History
                          </Link>
                          <button
                            onClick={() => handleRevokeWorker(w.workerId)}
                            disabled={actionLoadingId === w.workerId}
                            className="py-1.5 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
                          >
                            Revoke
                          </button>
                        </div>
                      </>
                    ) : w.status === "PENDING" ? (
                      <button
                        onClick={() => handleRevokeWorker(w.workerId)}
                        disabled={actionLoadingId === w.workerId}
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 text-xs font-semibold transition"
                      >
                        Cancel Pending Request
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setInputVal(w.workerPhone);
                          setIdentifierType("phone");
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 text-xs font-semibold transition flex items-center justify-center space-x-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Re-request Access</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Principles & Privacy Guarantees */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2 font-display">
            <Info className="w-4 h-4 text-orange-600" />
            <span>Agent Code of Conduct & Boundaries</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">Worker Ownership</strong>
              The worker remains the authoritative owner of their account and applications. An Agent assists a Worker but does not become the Worker.
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">Zero Wage Interception</strong>
              Agents cannot receive, escrow, or deduct worker payments. 100% of agreed wages are paid directly to the worker.
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <strong className="text-slate-900 block font-bold">Explicit Consent Required</strong>
              Every application must be authorized by the worker. Workers can revoke agent access at any moment from their dashboard.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
