import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Star,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Shield,
  Layers,
  X,
} from "lucide-react";

interface WorkerDetail {
  workerId: string;
  workerUserId: string;
  fullName: string;
  phone: string;
  bio: string | null;
  experienceYears: number;
  addressApproximate: string | null;
  serviceRadiusKm: number;
  availabilityStatus: string;
  isAvailableNow: boolean;
  averageRating: number;
  totalRatingsCount: number;
  completedTasksCount: number;
  skills: Array<{
    skillId: string;
    skillName: string;
    categoryName: string;
    yearsExperience: number;
  }>;
}

interface ApplicationItem {
  id: string;
  workOpportunityId: string;
  status: string;
  proposedWage: number | null;
  appliedAt: string;
  assisted: boolean;
  opportunityTitle: string;
  workType: string;
  urgency: string;
  workDate: string;
  paymentAmount: number;
  address: string;
}

interface AssignmentItem {
  id: string;
  status: string;
  assignedAt: string;
  agreedWage: number;
  opportunityTitle: string;
  workType: string;
  workDate: string;
  startTime: string;
  endTime: string;
  address: string;
}

export const AgentWorkerDetailPage: React.FC = () => {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Assignment Coordination modal state
  const [selectedCoordination, setSelectedCoordination] = useState<any | null>(null);

  const handleCoordinate = async (assignmentId: string) => {
    try {
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/agents/workers/${workerId}/assignments/${assignmentId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedCoordination(data.data);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!workerId) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("nearvia_auth_token");
        const headers = { Authorization: token ? `Bearer ${token}` : "" };

        // 1. Worker Detail
        const workerRes = await fetch(`/api/v1/agents/workers/${workerId}`, { headers });
        const workerJson = await workerRes.json();
        if (!workerRes.ok || !workerJson.success) {
          throw new Error(workerJson.error?.message || "Failed to load worker details");
        }
        setWorker(workerJson.data);

        // 2. Worker Applications
        const appRes = await fetch(`/api/v1/agents/workers/${workerId}/applications`, { headers });
        const appJson = await appRes.json();
        if (appRes.ok && appJson.success) {
          setApplications(appJson.data);
        }

        // 3. Worker Assignments
        const assignRes = await fetch(`/api/v1/agents/workers/${workerId}/assignments`, { headers });
        const assignJson = await assignRes.json();
        if (assignRes.ok && assignJson.success) {
          setAssignments(assignJson.data);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load assisted worker");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [workerId]);

  const handleRevoke = async () => {
    if (!workerId || !confirm("Are you sure you want to stop assisting this worker?")) return;
    try {
      setRevoking(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/agents/workers/${workerId}/revoke`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to revoke access");
      }
      navigate("/agent/dashboard");
    } catch (err: any) {
      alert(err.message || "Failed to revoke access");
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 max-w-5xl mx-auto px-4 py-12 text-center text-slate-400">
        Loading worker profile...
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="flex-1 max-w-5xl mx-auto px-4 py-12">
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-bold text-lg mb-1">Access Restricted</h3>
          <p className="text-sm">{error || "Worker details could not be retrieved"}</p>
          <Link
            to="/agent/dashboard"
            className="inline-block mt-4 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/agent/dashboard"
          className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white transition gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assisted Workers
        </Link>
        <button
          onClick={handleRevoke}
          disabled={revoking}
          className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition"
        >
          {revoking ? "Revoking..." : "Revoke My Assistance"}
        </button>
      </div>

      {/* Worker Header Card */}
      <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-2xl font-bold">
            {worker.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{worker.fullName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Consent Active
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                {worker.phone}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {worker.addressApproximate || "Location set"} (Within {worker.serviceRadiusKm} km)
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                {worker.averageRating.toFixed(1)} ({worker.totalRatingsCount} ratings)
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                {worker.completedTasksCount} Completed
              </span>
            </div>
          </div>
        </div>

        <div>
          <Link
            to={`/agent/workers/${worker.workerId}/find-work`}
            className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
          >
            <MapPin className="w-4 h-4" />
            Find Suitable Work
          </Link>
        </div>
      </div>

      {/* Skills Section */}
      <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Worker Skills ({worker.skills.length})
        </h3>
        {worker.skills.length === 0 ? (
          <p className="text-xs text-slate-400">No specific skills listed on profile.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {worker.skills.map((s) => (
              <span
                key={s.skillId}
                className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-700 text-xs text-slate-200 flex items-center gap-2"
              >
                <span className="font-semibold text-cyan-300">{s.skillName}</span>
                <span className="text-slate-500">· {s.yearsExperience} yrs</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Applications & Assignments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Applications */}
        <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-cyan-400" />
            Applications ({applications.length})
          </h3>
          {applications.length === 0 ? (
            <p className="text-xs text-slate-400">No applications submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/60 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-semibold text-white text-xs">{app.opportunityTitle}</h4>
                    <span className="text-xs text-slate-400">{app.workDate} · ₹{app.paymentAmount}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Assignments */}
        <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Assignments ({assignments.length})
          </h3>
          {assignments.length === 0 ? (
            <p className="text-xs text-slate-400">No active assignments.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((asg) => (
                <div
                  key={asg.id}
                  className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/60 flex items-center justify-between gap-2"
                >
                  <div>
                    <h4 className="font-semibold text-white text-xs">{asg.opportunityTitle}</h4>
                    <span className="text-xs text-slate-400">{asg.workDate} · Agreed: ₹{asg.agreedWage}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {asg.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCoordinate(asg.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-cyan-300 border border-slate-700 transition"
                    >
                      Coordinate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shift Coordination Modal */}
      {selectedCoordination && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 relative">
            <button
              onClick={() => setSelectedCoordination(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {selectedCoordination.status}
                </span>
                <span className="text-xs text-slate-400">· {selectedCoordination.workType}</span>
              </div>
              <h2 className="text-xl font-bold text-white">{selectedCoordination.opportunityTitle}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Assisting Worker: <strong className="text-white">{worker.fullName}</strong>
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400">Shift Schedule & Wages</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block">Agreed Wage:</span>
                    <strong className="text-sm font-black text-emerald-400">₹{selectedCoordination.agreedWage}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Work Date:</span>
                    <strong className="text-white">{selectedCoordination.workDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Shift Timing:</span>
                    <span className="text-slate-200">{new Date(selectedCoordination.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedCoordination.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Attendance:</span>
                    <span className="text-slate-200">{selectedCoordination.attendanceStatus}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400">Reporting Location</h4>
                <p className="text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{selectedCoordination.addressApproximate}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-cyan-400">Agent Coordination Guidance</h4>
                <p className="text-slate-300 leading-relaxed">{selectedCoordination.coordinationNotes}</p>
                <div className="mt-2 p-2 rounded-lg bg-slate-900/80 border border-slate-700 text-[11px] text-slate-400">
                  <strong className="text-white block mb-0.5">Worker Sovereignty Note:</strong>
                  Only the assigned worker can confirm and check-in to shifts using their own device or verification code.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCoordination(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
