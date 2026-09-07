import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Shield,
  ShieldAlert,
  Phone,
  MapPin,
  Clock,
  Check,
  X,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

interface AgentRelationship {
  id: string;
  agentId: string;
  agentUserId: string;
  agentName: string;
  agentPhone: string;
  assignedArea: string;
  description: string | null;
  languages: string[];
  verifiedWorkersCount: number;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  requestedAt: string;
  acceptedAt: string | null;
}

export const WorkerAgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch("/api/v1/workers/me/agents", {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to load agent relationships");
      }
      setAgents(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleAccept = async (relId: string) => {
    try {
      setActionLoading(relId);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/workers/me/agents/${relId}/accept`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to accept request");
      }
      fetchAgents();
    } catch (err: any) {
      alert(err.message || "Failed to accept request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (relId: string) => {
    if (!confirm("Are you sure you want to revoke this agent's assistance access?")) return;
    try {
      setActionLoading(relId);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/workers/me/agents/${relId}/revoke`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to revoke agent");
      }
      fetchAgents();
    } catch (err: any) {
      alert(err.message || "Failed to revoke agent");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingAgents = agents.filter((a) => a.status === "PENDING");
  const activeAgents = agents.filter((a) => a.status === "ACTIVE");

  return (
    <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Navigation */}
      <div>
        <Link
          to="/worker/dashboard"
          className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white transition gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent border border-cyan-500/30">
        <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold mb-2">
          <Users className="w-3.5 h-3.5" />
          <span>Assisted Access Management</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          Community Agents
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Community agents can help you discover nearby jobs and assist you with applications. You have 100% control over who assists you and can revoke access anytime.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading agent permissions...</div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Consent Requests */}
          {pendingAgents.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pending Assistance Requests ({pendingAgents.length})
              </h2>

              <div className="space-y-3">
                {pendingAgents.map((a) => (
                  <div
                    key={a.id}
                    className="p-5 rounded-2xl bg-slate-800/80 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h3 className="font-bold text-white text-base">{a.agentName}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          {a.agentPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {a.assignedArea}
                        </span>
                      </div>
                      {a.description && (
                        <p className="text-xs text-slate-300 pt-1 italic">"{a.description}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAccept(a.id)}
                        disabled={actionLoading === a.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept Assistance
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Agents */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Active Agents ({activeAgents.length})
            </h2>

            {activeAgents.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-800/40 border border-slate-700/60 text-center">
                <Users className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <h3 className="text-base font-semibold text-white mb-1">No Active Agents</h3>
                <p className="text-xs text-slate-400">
                  When a local agent requests to assist you and you accept, they will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeAgents.map((a) => (
                  <div
                    key={a.id}
                    className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">{a.agentName}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          {a.agentPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {a.assignedArea}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevoke(a.id)}
                      disabled={actionLoading === a.id}
                      className="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Revoke Access
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy & Safety Guarantee */}
          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Your Rights & Security
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                <strong className="text-white block mb-1">Applications & Earnings Are Yours</strong>
                All applications and earnings belong strictly to you. Agents cannot receive your pay or modify completed work.
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                <strong className="text-white block mb-1">Instant Access Revocation</strong>
                If you revoke access, the agent is immediately blocked from viewing your information or submitting applications.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
