import React, { useEffect, useState } from "react";
import { X, User, Phone, Mail, Shield, Briefcase } from "lucide-react";

interface AdminUserDetailModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: () => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  userId,
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [showStatusPrompt, setShowStatusPrompt] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [showRolePrompt, setShowRolePrompt] = useState(false);
  const [selectedRole, setSelectedRole] = useState("WORKER");
  const [roleReason, setRoleReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;

    async function fetchDetails() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("nearvia_auth_token");
        const res = await fetch(`/api/v1/admin/users/${userId}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setUserData(data.data);
          setSelectedRole(data.data.role);
        } else {
          setError(data.error?.message || "Failed to load user details");
        }
      } catch (err: any) {
        setError(err.message || "Network error");
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [isOpen, userId]);

  if (!isOpen || !userId) return null;

  const handleToggleStatus = async () => {
    if (!statusReason.trim()) return;
    try {
      setActionLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const nextStatus = userData.isActive ? "SUSPENDED" : "ACTIVE";
      const res = await fetch(`/api/v1/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          status: nextStatus,
          reason: statusReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserData((prev: any) => ({ ...prev, isActive: !prev.isActive }));
        setShowStatusPrompt(false);
        setStatusReason("");
        if (onStatusChanged) onStatusChanged();
      } else {
        alert(data.error?.message || "Failed to update status");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!roleReason.trim()) return;
    try {
      setActionLoading(true);
      const token = localStorage.getItem("nearvia_auth_token");
      const res = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          role: selectedRole,
          reason: roleReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserData((prev: any) => ({ ...prev, role: selectedRole }));
        setShowRolePrompt(false);
        setRoleReason("");
        if (onStatusChanged) onStatusChanged();
      } else {
        alert(data.error?.message || "Failed to update role");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md p-5 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">User Administration Detail</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
              Loading user record...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {userData && (
            <>
              {/* Profile Top Card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-lg font-black text-white">
                    {userData.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">{userData.fullName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        {userData.role}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          userData.isActive
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {userData.isActive ? "Active Account" : "Suspended"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowStatusPrompt(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      userData.isActive
                        ? "bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30"
                        : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {userData.isActive ? "Suspend User" : "Reactivate User"}
                  </button>
                  <button
                    onClick={() => setShowRolePrompt(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    Change Role
                  </button>
                </div>
              </div>

              {/* Status Reason Prompt */}
              {showStatusPrompt && (
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                  <h4 className="text-xs font-bold text-rose-300">
                    {userData.isActive ? "Reason for Account Suspension" : "Reason for Reactivation"}
                  </h4>
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Provide required justification for audit trail..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowStatusPrompt(false)}
                      className="px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleToggleStatus}
                      disabled={actionLoading || !statusReason.trim()}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {actionLoading ? "Processing..." : "Confirm Action"}
                    </button>
                  </div>
                </div>
              )}

              {/* Role Change Prompt */}
              {showRolePrompt && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300">Modify User Role</h4>
                  <div className="flex gap-2">
                    {["WORKER", "PROVIDER", "AGENT", "ADMIN"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRole(r)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          selectedRole === r
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={roleReason}
                    onChange={(e) => setRoleReason(e.target.value)}
                    placeholder="Provide justification for role modification audit log..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowRolePrompt(false)}
                      className="px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateRole}
                      disabled={actionLoading || !roleReason.trim()}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {actionLoading ? "Updating..." : "Save Role"}
                    </button>
                  </div>
                </div>
              )}

              {/* Contact & Identifiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-2.5">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-[10px] text-slate-500">Phone Number</div>
                    <div className="font-semibold text-slate-200">{userData.phone}</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-2.5">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-[10px] text-slate-500">Email Address</div>
                    <div className="font-semibold text-slate-200">
                      {userData.email || "None linked"}
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-2.5">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-[10px] text-slate-500">Account ID</div>
                    <div className="font-mono text-[11px] text-slate-400">{userData.id}</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-2.5">
                  <Briefcase className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-[10px] text-slate-500">Activity Metric</div>
                    <div className="font-semibold text-slate-200">
                      {userData.completedCount ?? 0} shifts completed / {userData.assignedCount ?? 0} assigned
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Submissions */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-300">Identity & Verification Records</h4>
                {userData.verifications && userData.verifications.length > 0 ? (
                  <div className="space-y-1.5">
                    {userData.verifications.map((v: any) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-white">{v.verification_type}</span>
                          <span className="text-slate-500 text-[10px] ml-2">
                            {new Date(v.submitted_at).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.status === "VERIFIED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : v.status === "REJECTED"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 text-slate-500 text-xs text-center">
                    No verification records submitted yet.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
