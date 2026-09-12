import React, { useState, useEffect, useCallback } from "react";
import { adminConfig } from "../../config";
import { WorkforceRadarMap } from "./WorkforceRadarMap";
import {
  RadarResponse,
  AdminRadarData,
  WorkforceRadarHotspot,
} from "@nearvia/types";
import {
  Compass,
  RefreshCw,
  Layers,
  Map as MapIcon,
  LayoutGrid,
  AlertTriangle,
} from "lucide-react";

export const WorkforceRadarPage: React.FC = () => {
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
    fetch(`${adminConfig.apiBaseUrl}/categories`)
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
      const token = localStorage.getItem("nearvia_admin_auth_token");
      const headers = { Authorization: token ? `Bearer ${token}` : "" };

      const params = new URLSearchParams({
        radius: selectedRadius.toString(),
      });
      if (selectedCategory && selectedCategory !== "ALL") {
        params.append("categoryId", selectedCategory);
      }

      const res = await fetch(`${adminConfig.apiBaseUrl}/radar?${params.toString()}`, { headers });
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
                Admin Console Live View • Real-time PostGIS spatial intelligence • Free OpenStreetMap
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

          {/* View Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === "split" ? "bg-white text-orange-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Split View"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === "map" ? "bg-white text-orange-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Map Only"
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === "cards" ? "bg-white text-orange-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Cards Only"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchRadar()}
            disabled={loading}
            className="p-2 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
            title="Refresh Radar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Main Content: Map & Intelligence Panels */}
      <div
        className={`grid gap-6 ${
          viewMode === "split"
            ? "grid-cols-1 lg:grid-cols-12"
            : viewMode === "map"
            ? "grid-cols-1"
            : "grid-cols-1"
        }`}
      >
        {/* Map Section */}
        {viewMode !== "cards" && (
          <div className={viewMode === "split" ? "lg:col-span-7 h-[560px]" : "h-[620px]"}>
            <WorkforceRadarMap
              center={searchCenter}
              radiusKm={selectedRadius}
              hotspots={getHotspotsList()}
              clusters={getClustersList()}
              role="ADMIN"
              selectedHotspotId={selectedHotspotId}
              onSelectHotspot={(id) => setSelectedHotspotId(id)}
            />
          </div>
        )}

        {/* Contextual Intelligence Section */}
        {viewMode !== "map" && (
          <div
            className={`${
              viewMode === "split" ? "lg:col-span-5" : "w-full"
            } space-y-4 max-h-[560px] overflow-y-auto pr-1`}
          >
            {radar && radar.role === "ADMIN" ? (
              <AdminRadarPanel
                data={radar as AdminRadarData}
                onSelectHotspot={(id) => setSelectedHotspotId(id)}
              />
            ) : (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                {loading ? "Scanning local PostGIS spatial clusters..." : "No radar data available"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component: Admin Live Platform Intelligence View
const AdminRadarPanel: React.FC<{
  data: AdminRadarData;
  onSelectHotspot: (id: string) => void;
}> = ({ data, onSelectHotspot }) => {
  return (
    <div className="space-y-4">
      {/* Key Metric Tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Active Jobs (Radius)</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{data.totalActiveJobs}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Available Workers</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{data.totalAvailableWorkers}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Supply / Demand Ratio</div>
          <div className="text-xl font-black text-orange-600 mt-0.5">
            {data.supplyDemandRatio ? `${data.supplyDemandRatio}x` : "1.0x"}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Completed Gigs (7d)</div>
          <div className="text-xl font-black text-emerald-600 mt-0.5">{data.recentCompletedJobsCount}</div>
        </div>
      </div>

      {/* Category Supply vs Demand Matrix */}
      {data.categorySupplyDemand && data.categorySupplyDemand.length > 0 && (
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
      {data.hotspots && data.hotspots.length > 0 && (
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
