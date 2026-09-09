import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Clock,
  IndianRupee,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Search,
  Send,
  X,
} from "lucide-react";

interface DiscoveredJob {
  id: string;
  title: string;
  description: string;
  workType: string;
  urgency: string;
  workDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  paymentAmount: number;
  paymentType: string;
  distanceMeters: number;
  addressApproximate: string;
  matchScore?: number;
  matchExplanation?: {
    reasons: string[];
    limitations: string[];
  };
}

export const AgentWorkDiscoveryPage: React.FC = () => {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();

  const [workerName, setWorkerName] = useState<string>("");
  const [opportunities, setOpportunities] = useState<DiscoveredJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [workType, setWorkType] = useState<string>("");
  const [sort, setSort] = useState<string>("RECOMMENDED");

  // Apply Modal state
  const [selectedJob, setSelectedJob] = useState<DiscoveredJob | null>(null);
  const [proposedWage, setProposedWage] = useState<string>("");
  const [workerNotes, setWorkerNotes] = useState<string>("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Load worker details & nearby jobs
  const fetchDiscovery = async () => {
    if (!workerId) return;
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const headers = { Authorization: token ? `Bearer ${token}` : "" };

      // Fetch worker name if not set
      if (!workerName) {
        const workerRes = await fetch(`/api/v1/agents/workers/${workerId}`, { headers });
        const workerJson = await workerRes.json();
        if (workerRes.ok && workerJson.success) {
          setWorkerName(workerJson.data.fullName);
        }
      }

      // Query params
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);
      if (workType) queryParams.set("workType", workType);
      if (sort) queryParams.set("sort", sort);

      const res = await fetch(`/api/v1/agents/workers/${workerId}/work?${queryParams.toString()}`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to discover nearby work for worker");
      }
      setOpportunities(data.data.opportunities || []);
    } catch (err: any) {
      setError(err.message || "Failed to discover work");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscovery();
  }, [workerId, workType, sort]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDiscovery();
  };

  const handleOpenApplyModal = (job: DiscoveredJob) => {
    setSelectedJob(job);
    setProposedWage(job.paymentAmount.toString());
    setWorkerNotes("");
    setConsentConfirmed(false);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleCloseApplyModal = () => {
    setSelectedJob(null);
    setConsentConfirmed(false);
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !workerId) return;
    if (!consentConfirmed) {
      setSubmitError("You must confirm worker consent before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/agents/workers/${workerId}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          workOpportunityId: selectedJob.id,
          proposedWage: proposedWage ? parseFloat(proposedWage) : undefined,
          workerNotes: workerNotes.trim() || undefined,
          consentConfirmed: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to submit assisted application");
      }

      setSubmitSuccess("Application successfully submitted on behalf of the worker!");
      setTimeout(() => {
        handleCloseApplyModal();
        navigate(`/agent/workers/${workerId}`);
      }, 1500);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to={`/agent/workers/${workerId}`}
          className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white transition gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Worker Profile
        </Link>
      </div>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold mb-2">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Assisted Job Discovery (Hyperlocal 5 KM)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Opportunities for {workerName || "Worker"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Discovering verified work within 5 km of worker's registered location. You can review details and assist them with applying.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or category..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3">
          <select
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
          >
            <option value="">All Work Types</option>
            <option value="TASK">Task (1-3h)</option>
            <option value="SHIFT">Shift (4-8h)</option>
            <option value="JOB">Job (Multi-day)</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
          >
            <option value="RECOMMENDED">Best Match</option>
            <option value="NEAREST">Nearest Distance</option>
            <option value="STARTING_SOON">Starting Soon</option>
            <option value="HIGHEST_PAY">Highest Pay</option>
          </select>
        </div>
      </div>

      {/* Opportunities List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Searching matching hyperlocal opportunities...</div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-800/40 border border-slate-700/60 text-center">
          <MapPin className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white mb-1">No Opportunities in 5 KM Radius</h3>
          <p className="text-xs text-slate-400">Try changing your search terms or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {opportunities.map((job) => (
            <div
              key={job.id}
              className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-cyan-500/40 transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-1.5">
                      {job.workType}
                    </span>
                    <h3 className="font-bold text-white text-base leading-snug">{job.title}</h3>
                  </div>
                  <div className="text-right">
                    <span className="block text-lg font-extrabold text-cyan-400">
                      ₹{job.paymentAmount}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">{job.paymentType.toLowerCase()}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2">{job.description}</p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {(job.distanceMeters / 1000).toFixed(1)} km away ({job.addressApproximate})
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {job.workDate} ({job.durationHours} hrs)
                  </span>
                </div>

                {job.matchScore !== undefined && (
                  <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-300 flex items-center justify-between">
                    <span>Match Score</span>
                    <span className="font-bold">{job.matchScore}%</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleOpenApplyModal(job)}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/10"
                >
                  <Send className="w-3.5 h-3.5" />
                  Assist Application for {workerName || "Worker"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assist Application Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 relative">
            <button
              onClick={handleCloseApplyModal}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Assisted Job Application
              </span>
              <h2 className="text-xl font-bold text-white mt-1">{selectedJob.title}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Applying on behalf of: <strong className="text-white">{workerName}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmitApplication} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Proposed Wage (₹)
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    value={proposedWage}
                    onChange={(e) => setProposedWage(e.target.value)}
                    required
                    min={1}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Employer offered: ₹{selectedJob.paymentAmount} ({selectedJob.paymentType})
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Worker Notes / Experience Summary (Optional)
                </label>
                <textarea
                  value={workerNotes}
                  onChange={(e) => setWorkerNotes(e.target.value)}
                  placeholder="Explain why this worker is a great fit for this role..."
                  rows={3}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Consent Confirmation */}
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-2">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="consentConfirmation"
                    checked={consentConfirmed}
                    onChange={(e) => setConsentConfirmed(e.target.checked)}
                    required
                    className="mt-0.5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
                  />
                  <label htmlFor="consentConfirmation" className="text-xs text-slate-300 font-medium leading-relaxed">
                    <strong className="text-white block mb-0.5">Worker Consent Affirmation</strong>
                    Worker has given permission to Agent to assist with NEARVIA. I confirm that {workerName || "the worker"} has reviewed this job and authorized this application.
                  </label>
                </div>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseApplyModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-500/10"
                >
                  {submitting ? "Submitting..." : "Submit Assisted Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
