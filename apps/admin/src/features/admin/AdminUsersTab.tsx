import React, { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminUserDetailModal } from "./AdminUserDetailModal";

export const AdminUsersTab: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem("nearvia_admin_auth_token") ||
        localStorage.getItem("nearvia_auth_token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search.trim()) params.append("search", search.trim());
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/v1/admin/users?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by full name, phone number, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-orange-500 shadow-xs"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-orange-500 shadow-xs"
          >
            <option value="">All Roles</option>
            <option value="WORKER">Workers</option>
            <option value="PROVIDER">Employers</option>
            <option value="AGENT">Agents</option>
            <option value="ADMIN">Admins</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-orange-500 shadow-xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-5">User</th>
                <th className="py-3.5 px-5">Role</th>
                <th className="py-3.5 px-5">Contact</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Joined</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    Loading user accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No users found matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center font-black text-xs">
                          {u.fullName?.charAt(0) || "U"}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900">{u.fullName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{u.id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-800 border border-orange-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="text-slate-800 font-medium">{u.phone}</div>
                      <div className="text-[10px] text-slate-400">{u.email || "No email"}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          u.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {u.isActive ? "ACTIVE" : "SUSPENDED"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 font-medium">
                      {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setSelectedUserId(u.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black transition-all shadow-xs cursor-pointer"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div>
            Showing {users.length} of {total} users
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-800">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 15 >= total}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {selectedUserId && (
        <AdminUserDetailModal
          userId={selectedUserId}
          isOpen={!!selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onStatusChanged={fetchUsers}
        />
      )}
    </div>
  );
};
