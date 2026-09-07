import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserPlus, Phone, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

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
}

export const AgentDashboardPage: React.FC = () => {
  const [workers, setWorkers] = useState<WorkerRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  // Request worker access state
  const [phoneInput, setPhoneInput] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

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
    if (!phoneInput.trim()) return;

    try {
      setRequesting(true);
      setRequestError(null);
      setRequestSuccess(null);

      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch("/api/v1/agents/workers/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ workerPhone: phoneInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to request access");
      }

      setRequestSuccess("Access request sent to worker. They will see it in their portal.");
      setPhoneInput("");
      fetchWorkers();
    } catch (err: any) {
      setRequestError(err.message || "Failed to request access");
    } finally {
      setRequesting(false);
    }
  };

  const activeWorkers = workers.filter((w) => w.status === "ACTIVE");
  const pendingWorkers = workers.filter((w) => w.status === "PENDING");

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
              Help local workers discover jobs, manage applications, and resolve disputes.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-100 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Assisted Workers</div>
              <div className="text-xl font-black text-orange-600 font-display">{activeWorkers.length}</div>
            </div>
            {pendingWorkers.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Pending Requests</div>
                <div className="text-xl font-black text-blue-600 font-display">{pendingWorkers.length}</div>
              </div>
            )}
          </div>
        </div>

        {/* Request Access Form */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
          <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
            <UserPlus className="w-4 h-4 text-orange-600" />
            <span>Connect & Support a New Worker</span>
          </h2>
          <p className="text-xs text-slate-500">
            Enter the worker's registered phone number to send an assistance authorization request.
          </p>

          <form onSubmit={handleRequestAccess} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm font-medium focus:bg-white focus:border-orange-500"
              />
            </div>
            <button
              type="submit"
              disabled={requesting || !phoneInput.trim()}
              className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
            >
              {requesting ? "Sending..." : "Send Request"}
            </button>
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

        {/* Active Supported Workers List */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
          <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
            <Users className="w-4 h-4 text-orange-600" />
            <span>Active Worker Relationships</span>
          </h2>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Loading workers...
            </div>
          ) : activeWorkers.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">
              No active worker relationships. Request access to a worker above.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeWorkers.map((w) => (
                <div
                  key={w.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-orange-300 transition-all space-y-3"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-800 font-black flex items-center justify-center text-sm">
                      {w.workerFullName?.charAt(0) || "W"}
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">{w.workerFullName}</div>
                      <div className="text-[11px] text-slate-500">{w.workerPhone}</div>
                    </div>
                  </div>

                  <Link
                    to={`/agent/workers/${w.workerId}`}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-900 border border-slate-200 text-xs font-bold transition-colors flex items-center justify-center space-x-1 shadow-xs"
                  >
                    <span>Manage Worker Portfolio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
