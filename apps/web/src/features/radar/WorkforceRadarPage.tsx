import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { WorkforceRadarMap } from "./WorkforceRadarMap";
import {
  RadarResponse,
  WorkerRadarData,
  ProviderRadarData,
  AgentRadarData,
  AdminRadarData,
  WorkforceRadarHotspot,
} from "@nearvia/types";
import {
  Compass,
  Briefcase,
  ShieldCheck,
  RefreshCw,
  Layers,
  Map as MapIcon,
  LayoutGrid,
  AlertTriangle,
} from "lucide-react";

export const WorkforceRadarPage: React.FC = () => {
  const { user } = useAuth();
  const [radar, setRadar] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRadius, setSelectedRadius] = useState<number>(5.0);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<"split" | "map" | "cards">("split");
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);

  // Fetch Categories for Filter Dropdown
  useEffect(() => {
    fetch(`${webConfig.apiBaseUrl}/categories`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data && Array.isArray(json.data)) {
          setCategories(json.data.map((c: any) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Role-Specific Radar Data from /api/v1/radar
  const fetchRadar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("nearvia_auth_token");
      const headers = { Authorization: token ? `Bearer ${token}` : "" };

      const params = new URLSearchParams({
        radius: selectedRadius.toString(),
      });
      if (selectedCategory && selectedCategory !== "ALL") {
        params.append("categoryId", selectedCategory);
      }

      const res = await fetch(`${webConfig.apiBaseUrl}/radar?${params.toString()}`, { headers });
      const json = await res.json();

      if (res.ok && json.success && json.data) {
        setRadar(json.data);
      } else {
        setError(json.message || "Failed to load radar data");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading radar");
    } finally {
      setLoading(false);
    }
  }, [selectedRadius, selectedCategory]);

  useEffect(() => {
    fetchRadar();
  }, [fetchRadar]);

  const defaultCenter = { latitude: 12.9716, longitude: 77.5946 };
  const searchCenter = radar?.searchCenter || defaultCenter;

  const getHotspotsList = (): WorkforceRadarHotspot[] => {
    if (!radar) return [];
    if ("hotspots" in radar && Array.isArray(radar.hotspots)) {
      return radar.hotspots;
    }
    return [];
  };

  const getClustersList = () => {
    if (!radar) return [];
    if ("clusters" in radar && Array.isArray(radar.clusters)) {
      return radar.clusters;
    }
    return [];
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-600">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 font-display">
                Workforce Radar & Demand Intelligence
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Real-time PostGIS spatial intelligence • ₹0 Free-First • Zero Paid Maps
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="ALL">All Trade Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Radius Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
            {[1, 3, 5, 10, 15].map((rad) => (
              <button
                key={rad}
                type="button"
                onClick={() => setSelectedRadius(rad)}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all ${
                  selectedRadius === rad
                    ? "bg-white text-orange-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {rad}K
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`p-1.5 rounded-xl ${viewMode === "split" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400"}`}
              title="Split View"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`p-1.5 rounded-xl ${viewMode === "map" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400"}`}
              title="Map Only"
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-xl ${viewMode === "cards" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400"}`}
              title="Cards Only"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchRadar}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            title="Refresh Radar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Privacy & Anti-Surveillance Banner */}
      <div className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start space-x-3 text-xs text-emerald-900">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold">Privacy Guarantee:</span>{" "}
          <span>
            Worker live coordinates are never tracked, recorded, or broadcast. All workforce data is
            clustered into coarse ~1.1 km neighborhood zones with k-anonymity protection.
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Main Radar Grid Layout */}
      <div className={`grid gap-6 ${viewMode === "split" ? "lg:grid-cols-12" : "grid-cols-1"}`}>
        {/* Left Column: Interactive Leaflet Map (Visible in split & map modes) */}
        {viewMode !== "cards" && (
          <div className={viewMode === "split" ? "lg:col-span-7 h-[500px]" : "w-full h-[600px]"}>
            <WorkforceRadarMap
              center={searchCenter}
              radiusKm={selectedRadius}
              hotspots={getHotspotsList()}
              clusters={getClustersList()}
              role={radar?.role || (user?.role as any) || "WORKER"}
              selectedHotspotId={selectedHotspotId}
              onSelectHotspot={(id) => setSelectedHotspotId(id)}
            />
          </div>
        )}

        {/* Right Column: Role-Tailored Metrics & Insights */}
        {viewMode !== "map" && (
          <div className={viewMode === "split" ? "lg:col-span-5 space-y-4" : "w-full space-y-4"}>
            {/* WORKER ROLE RADAR */}
            {radar?.role === "WORKER" && (
              <WorkerRadarSection
                data={radar as WorkerRadarData}
                onSelectHotspot={(id) => setSelectedHotspotId(id)}
              />
            )}

            {/* PROVIDER ROLE RADAR */}
            {radar?.role === "PROVIDER" && (
              <ProviderRadarSection
                data={radar as ProviderRadarData}
              />
            )}

            {/* AGENT ROLE RADAR */}
            {radar?.role === "AGENT" && (
              <AgentRadarSection
                data={radar as AgentRadarData}
                onSelectHotspot={(id) => setSelectedHotspotId(id)}
              />
            )}

            {/* ADMIN ROLE RADAR */}
            {radar?.role === "ADMIN" && (
              <AdminRadarSection
                data={radar as AdminRadarData}
                onSelectHotspot={(id) => setSelectedHotspotId(id)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sub-components for Role-Specific Sections ──────────────────────────

const WorkerRadarSection: React.FC<{
  data: WorkerRadarData;
  onSelectHotspot: (id: string) => void;
}> = ({ data, onSelectHotspot }) => {
  return (
    <div className="space-y-4">
      {/* 2 KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
          <div className="text-[11px] font-bold text-blue-600 uppercase">Active Jobs in Radius</div>
          <div className="text-2xl font-black text-blue-900 mt-0.5">{data.activeOpportunitiesCount}</div>
          <div className="text-[10px] text-blue-500 font-medium">Within {data.radiusKm} KM</div>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
          <div className="text-[11px] font-bold text-emerald-600 uppercase">Matching Your Skills</div>
          <div className="text-2xl font-black text-emerald-900 mt-0.5">{data.matchedJobDemandCount}</div>
          <div className="text-[10px] text-emerald-600 font-medium">Ready for application</div>
        </div>
      </div>

      {/* Demand by Category Progress */}
      {data.demandByCategory.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
            <span>Job Demand by Category</span>
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
          </h3>
          <div className="space-y-2.5">
            {data.demandByCategory.map((c) => (
              <div key={c.categoryId} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>{c.categoryName}</span>
                  <span className="text-slate-500">
                    {c.activeJobsCount} jobs · Avg ₹{c.avgWage}/day
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: `${Math.min(100, (c.activeJobsCount / Math.max(1, data.activeOpportunitiesCount)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Demanded Skills */}
      {data.demandBySkill.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            High Demand Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.demandBySkill.map((s) => (
              <span
                key={s.skillId}
                className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/60 flex items-center space-x-1"
              >
                <span>{s.skillName}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
                  {s.jobsDemandingCount}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Demand Hotspots List */}
      {data.hotspots.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Nearby Demand Hotspots ({data.hotspots.length})
          </h3>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {data.hotspots.map((h) => (
              <div
                key={h.id}
                onClick={() => onSelectHotspot(h.id)}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-orange-400 cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">{h.locationName}</div>
                  <div className="text-[10px] text-slate-500">
                    {h.topCategories.join(", ")}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-blue-600">
                    {h.activeOpportunitiesCount} Openings
                  </span>
                  {h.avgWage ? (
                    <div className="text-[10px] font-bold text-emerald-600">
                      ₹{h.avgWage}/day
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ProviderRadarSection: React.FC<{
  data: ProviderRadarData;
}> = ({ data }) => {
  return (
    <div className="space-y-4">
      {/* 2 KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
          <div className="text-[11px] font-bold text-emerald-600 uppercase">Available Workers</div>
          <div className="text-2xl font-black text-emerald-900 mt-0.5">{data.totalAvailableWorkers}</div>
          <div className="text-[10px] text-emerald-500 font-medium">Online within {data.radiusKm} KM</div>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
          <div className="text-[11px] font-bold text-amber-700 uppercase">Hiring Competition</div>
          <div className="text-2xl font-black text-amber-900 mt-0.5">{data.competingOpenJobsCount}</div>
          <div className="text-[10px] text-amber-600 font-medium">Other open jobs nearby</div>
        </div>
      </div>

      {/* Available Workers by Category */}
      {data.categoryCounts.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Online Talent by Trade
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {data.categoryCounts.map((cat) => (
              <div
                key={cat.categoryId}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5"
              >
                <div className="text-[11px] font-bold text-slate-600 truncate">{cat.categoryName}</div>
                <div className="text-sm font-black text-slate-900 flex items-center space-x-1">
                  <span>{cat.availableWorkersCount}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">online</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anonymized Talent Cards (Privacy-Safe) */}
      {data.availableTalent && data.availableTalent.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Anonymized Talent Cards ({data.availableTalent.length})
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">Exact GPS Hidden</span>
          </div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {data.availableTalent.map((t) => (
              <div
                key={t.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-black text-slate-900">{t.primarySkill}</div>
                  <div className="text-[10px] text-slate-500">
                    {t.areaName} · {t.distanceKm} km away
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    ★ {t.rating.toFixed(1)}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online now" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AgentRadarSection: React.FC<{
  data: AgentRadarData;
  onSelectHotspot: (id: string) => void;
}> = ({ data, onSelectHotspot }) => {
  return (
    <div className="space-y-4">
      {/* 2 KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100">
          <div className="text-[11px] font-bold text-purple-600 uppercase">Linked Workers</div>
          <div className="text-2xl font-black text-purple-900 mt-0.5">
            {data.onlineLinkedWorkers} / {data.totalLinkedWorkers}
          </div>
          <div className="text-[10px] text-purple-500 font-medium">Online available now</div>
        </div>
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
          <div className="text-[11px] font-bold text-blue-600 uppercase">Demand For Your Workers</div>
          <div className="text-2xl font-black text-blue-900 mt-0.5">{data.linkedSkillsDemandCount}</div>
          <div className="text-[10px] text-blue-500 font-medium">Gigs matching linked skills</div>
        </div>
      </div>

      {/* Top Demanded Skills */}
      {data.topDemandedSkillsForLinked.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            High Demand for Linked Skills
          </h3>
          <div className="space-y-1.5">
            {data.topDemandedSkillsForLinked.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs font-bold text-slate-700"
              >
                <span>{s.skillName}</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-black text-[11px]">
                  {s.jobsCount} open jobs
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operating Area Hotspots */}
      {data.hotspots.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Assisted Zone Hotspots
          </h3>
          <div className="space-y-1.5">
            {data.hotspots.map((h) => (
              <div
                key={h.id}
                onClick={() => onSelectHotspot(h.id)}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 cursor-pointer flex justify-between text-xs font-bold"
              >
                <span className="text-slate-800">{h.locationName}</span>
                <span className="text-purple-700">{h.activeOpportunitiesCount} Gigs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminRadarSection: React.FC<{
  data: AdminRadarData;
  onSelectHotspot: (id: string) => void;
}> = ({ data, onSelectHotspot }) => {
  return (
    <div className="space-y-4">
      {/* 4 KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Total Active Jobs</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{data.totalActiveJobs}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Available Workers</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{data.totalAvailableWorkers}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Supply / Demand Ratio</div>
          <div className="text-xl font-black text-orange-600 mt-0.5">{data.supplyDemandRatio}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Completed Gigs (7d)</div>
          <div className="text-xl font-black text-emerald-600 mt-0.5">{data.recentCompletedJobsCount}</div>
        </div>
      </div>

      {/* Category Supply vs Demand Matrix */}
      {data.categorySupplyDemand.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Supply vs Demand Balance
          </h3>
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {data.categorySupplyDemand.map((c) => (
              <div
                key={c.categoryId}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{c.categoryName}</div>
                  <div className="text-[10px] text-slate-500">
                    {c.activeJobsCount} Jobs · {c.availableWorkersCount} Workers
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    c.status === "SHORTAGE"
                      ? "bg-rose-100 text-rose-800"
                      : c.status === "SURPLUS"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urban Node Hotspots */}
      {data.hotspots.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Urban Activity Hotspots
          </h3>
          <div className="space-y-1.5">
            {data.hotspots.map((h) => (
              <div
                key={h.id}
                onClick={() => onSelectHotspot(h.id)}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-orange-400 cursor-pointer flex justify-between text-xs font-bold transition-all"
              >
                <span className="text-slate-800">{h.locationName}</span>
                <span className="text-blue-700">{h.activeOpportunitiesCount} Gigs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
