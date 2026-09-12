import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const AdminAuditLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (actionFilter) params.append("action", actionFilter);

      const res = await fetch(`/api/v1/admin/audit-logs?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.auditLogs || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-orange-500 shadow-xs"
        >
          <option value="">All Security & Moderation Actions</option>
          <option value="USER_STATUS_UPDATED">USER_STATUS_UPDATED</option>
          <option value="USER_ROLE_UPDATED">USER_ROLE_UPDATED</option>
          <option value="VERIFICATION_APPROVED">VERIFICATION_APPROVED</option>
          <option value="VERIFICATION_REJECTED">VERIFICATION_REJECTED</option>
          <option value="REPORT_SUBMITTED">REPORT_SUBMITTED</option>
          <option value="REPORT_MODERATION_UPDATED">REPORT_MODERATION_UPDATED</option>
          <option value="DISPUTE_OPENED">DISPUTE_OPENED</option>
          <option value="DISPUTE_MODERATION_UPDATED">DISPUTE_MODERATION_UPDATED</option>
          <option value="WORK_OPPORTUNITY_MODERATED_CANCELLED">WORK_OPPORTUNITY_MODERATED_CANCELLED</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">Actor</th>
                <th className="py-3.5 px-5">Action</th>
                <th className="py-3.5 px-5">Target Entity</th>
                <th className="py-3.5 px-5">Payload Delta</th>
                <th className="py-3.5 px-5 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans font-medium">
                    Loading immutable audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans font-medium">
                    No audit logs recorded for this action.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5 text-slate-500 font-medium">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-5 text-slate-800 font-sans">
                      <span className="font-bold text-slate-900">{log.actorName}</span>
                      <div className="text-[10px] text-slate-400 font-mono">{log.actorId?.substring(0, 8)}...</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200 font-sans">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 font-sans font-medium">
                      {log.targetEntity}: <span className="font-mono text-slate-400">{log.targetId?.substring(0, 8)}...</span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 max-w-xs truncate" title={JSON.stringify(log.payload)}>
                      {JSON.stringify(log.payload)}
                    </td>
                    <td className="py-3.5 px-5 text-right text-slate-400 font-mono">
                      {log.ipAddress || "127.0.0.1"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-2">
        <div>
          Showing {logs.length} of {total} audit records
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-xs transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-slate-700">Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20) || loading}
            className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-xs transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
