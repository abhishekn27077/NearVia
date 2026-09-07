import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Compass,
  Search,
  MapPin,
  SlidersHorizontal,
  RefreshCw,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  List,
  X,
  Mic,
  MicOff,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { webConfig } from "../../config";
import {
  DiscoveredOpportunity,
  DiscoveryDateFilter,
  DiscoveryDurationFilter,
  DiscoverySortOption,
  GeoCoordinates,
  Category,
} from "@nearvia/types";
import { BANGALORE_LOCALITIES, formatDistance } from "@nearvia/shared";
import { DiscoveredJobCard } from "./DiscoveredJobCard";
import { DiscoveryMap } from "./DiscoveryMap";
import { ApplyModal } from "../applications/ApplyModal";

export const FindWorkPage: React.FC = () => {
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQ = searchParams.get("q") || "";
  const initialLoc = searchParams.get("locality") || "";
  const initialCat = searchParams.get("categoryId") || "ALL";
  const initialSelected = searchParams.get("selected") || null;

  // Search & Spatial State
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [isListening, setIsListening] = useState(false);

  const startVoiceSearch = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search requires a supported browser (Google Chrome, Microsoft Edge, or Android WebKit).");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang =
        language === "kn" ? "kn-IN" : language === "hi" ? "hi-IN" : "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setSearchQuery(transcript);
          setCurrentPage(1);
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };
  const matchedLoc = BANGALORE_LOCALITIES.find(
    (l) => l.name.toLowerCase() === initialLoc.toLowerCase(),
  );

  const [searchCenter, setSearchCenter] = useState<GeoCoordinates>(
    matchedLoc
      ? { latitude: matchedLoc.latitude, longitude: matchedLoc.longitude }
      : { latitude: 12.9716, longitude: 77.5946 },
  );
  const [locationName, setLocationName] = useState(
    matchedLoc ? matchedLoc.name : "MG Road / Brigade Road, Bangalore",
  );
  const [radiusKm, setRadiusKm] = useState<number>(5);

  // Filters State
  const [workType, setWorkType] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<DiscoveryDateFilter>("ALL");
  const [durationFilter, setDurationFilter] =
    useState<DiscoveryDurationFilter>("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("ALL");
  const [categoryId, setCategoryId] = useState<string>(initialCat);
  const [sortOption, setSortOption] =
    useState<DiscoverySortOption>("RECOMMENDED");

  // Data & View State
  const [categories, setCategories] = useState<Category[]>([]);
  const [opportunities, setOpportunities] = useState<DiscoveredOpportunity[]>(
    [],
  );
  const [totalOpportunities, setTotalOpportunities] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<
    string | null
  >(initialSelected);
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">("split");
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());

  // Load Categories & Auto-Detect GPS / Worker Profile Location
  useEffect(() => {
    loadCategories();

    if (!initialLoc && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setSearchCenter({ latitude: lat, longitude: lng });
          setLocationName("Current Location (Nearby)");

          // Background sync to worker profile in database if logged in
          if (token) {
            fetch(`${webConfig.apiBaseUrl}/workers/me/location`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                addressApproximate: "Current Location Zone, Bengaluru",
              }),
            }).catch(() => {});
          }
        },
        () => {
          // If denied, fallback to worker saved profile or Bangalore center
          loadWorkerLocation();
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      );
    } else {
      loadWorkerLocation();
    }
  }, [token, initialLoc]);

  // Query Opportunities on filter/search change
  useEffect(() => {
    fetchNearbyOpportunities();
  }, [
    token,
    searchCenter,
    radiusKm,
    workType,
    dateFilter,
    durationFilter,
    urgencyFilter,
    categoryId,
    sortOption,
    currentPage,
  ]);

  const loadCategories = async () => {
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/categories`);
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch {
      // Offline fallback
    }
  };

  const loadWorkerLocation = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/workers/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const profile = json.data;
        if (profile?.location?.latitude && profile?.location?.longitude) {
          setSearchCenter({
            latitude: profile.location.latitude,
            longitude: profile.location.longitude,
          });
          if (profile.addressApproximate) {
            setLocationName(profile.addressApproximate);
          }
          if (profile.serviceRadiusKm) {
            setRadiusKm(profile.serviceRadiusKm);
          }
        }
      }
    } catch {
      // Fallback
    }
  };

  const fetchNearbyOpportunities = async () => {
    setIsLoading(true);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("lat", searchCenter.latitude.toString());
      queryParams.set("lng", searchCenter.longitude.toString());
      queryParams.set("radiusKm", radiusKm.toString());
      queryParams.set("page", currentPage.toString());
      queryParams.set("limit", "15");

      if (searchQuery.trim()) queryParams.set("q", searchQuery.trim());
      if (workType !== "ALL") queryParams.set("workType", workType);
      if (dateFilter !== "ALL") queryParams.set("dateFilter", dateFilter);
      if (durationFilter !== "ALL")
        queryParams.set("durationFilter", durationFilter);
      if (urgencyFilter !== "ALL") queryParams.set("urgency", urgencyFilter);
      if (categoryId !== "ALL") queryParams.set("categoryId", categoryId);
      if (sortOption !== "RECOMMENDED") queryParams.set("sort", sortOption);

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/discover?${queryParams.toString()}`,
        { headers },
      );

      if (res.ok) {
        const json = await res.json();
        const opps: DiscoveredOpportunity[] = json.data || [];
        setOpportunities(opps);
        setTotalOpportunities(json.meta?.total || opps.length);
        setTotalPages(json.meta?.totalPages || 1);

        // If URL had initialSelected, keep it selected
        if (initialSelected && !selectedOpportunityId) {
          const found = opps.find((o) => o.id === initialSelected);
          if (found) setSelectedOpportunityId(found.id);
        }
      } else {
        throw new Error("Failed to fetch opportunities");
      }
    } catch {
      // On network failure or empty result
      setOpportunities([]);
      setTotalOpportunities(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalitySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const loc = BANGALORE_LOCALITIES.find((l) => l.name === e.target.value);
    if (loc) {
      setSearchCenter({ latitude: loc.latitude, longitude: loc.longitude });
      setLocationName(loc.name);
      setCurrentPage(1);
      setSearchParams((prev) => {
        prev.set("locality", loc.name);
        return prev;
      });
    }
  };

  const handleGpsDetect = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setSearchCenter({
            latitude: lat,
            longitude: lng,
          });
          setLocationName("Current Location (Nearby)");
          setCurrentPage(1);

          if (token) {
            fetch(`${webConfig.apiBaseUrl}/workers/me/location`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                addressApproximate: "Current Location Zone, Bengaluru",
              }),
            }).catch(() => {});
          }
        },
        () => {
          alert(
            "GPS permission denied. Please select a locality from the dropdown.",
          );
        },
      );
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchNearbyOpportunities();
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setWorkType("ALL");
    setDateFilter("ALL");
    setDurationFilter("ALL");
    setUrgencyFilter("ALL");
    setCategoryId("ALL");
    setSortOption("RECOMMENDED");
    setRadiusKm(5);
    setCurrentPage(1);
  };

  const selectedOpportunity = opportunities.find(
    (o) => o.id === selectedOpportunityId,
  );

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 bg-[#FAFAF9]">
      {/* 1. Top Search & Location Header Bar */}
      <div className="p-6 rounded-3xl card-premium space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2 border border-blue-100">
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>Hyperlocal 5 KM Discovery • Bengaluru</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
              Work Within Reach
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Real-time tasks, shifts, and jobs with same-day settlement around{" "}
              <strong className="text-slate-800">
                {locationName.split("/")[0]}
              </strong>
              .
            </p>
          </div>

          {/* Location Center Selector & GPS & Radius */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                id="locality-select"
                name="locality"
                aria-label="Select Locality in Bengaluru"
                onChange={handleLocalitySelect}
                value={
                  BANGALORE_LOCALITIES.some((l) => l.name === locationName)
                    ? locationName
                    : ""
                }
                className="pl-8 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold focus:outline-none focus:border-blue-600 shadow-xs cursor-pointer"
              >
                <option value="" disabled>
                  {locationName}
                </option>
                {BANGALORE_LOCALITIES.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGpsDetect}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-blue-700 border border-slate-200 text-xs font-bold transition-colors flex items-center space-x-1 shadow-xs btn-tactile active:scale-95"
              title="Detect Current GPS Location"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>GPS</span>
            </button>

            {/* Radius Switcher */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              {[1, 3, 5, 10, 15].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRadiusKm(r);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-black transition-all btn-tactile active:scale-95 ${
                    radiusKm === r
                      ? "bg-blue-600 text-white shadow-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Text & Voice Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              id="find-work-search-input"
              name="searchQuery"
              aria-label="Search work by trade or skill"
              type="text"
              placeholder={isListening ? t.voiceSearchListening : t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-11 pr-12 py-3.5 rounded-2xl bg-slate-50 border text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-600 transition-all ${
                isListening
                  ? "border-orange-500 ring-2 ring-orange-200 bg-orange-50/20 text-orange-950 placeholder-orange-600"
                  : "border-slate-200 placeholder-slate-400"
              }`}
            />
            {/* Voice Search Mic & Dynamic Waveform */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
              {isListening && (
                <div className="flex items-center space-x-0.5 px-1.5 h-5" aria-hidden="true">
                  <span className="w-0.5 h-3 bg-orange-600 rounded-full voice-wave-bar" />
                  <span className="w-0.5 h-4 bg-orange-600 rounded-full voice-wave-bar" />
                  <span className="w-0.5 h-5 bg-orange-600 rounded-full voice-wave-bar" />
                  <span className="w-0.5 h-3.5 bg-orange-600 rounded-full voice-wave-bar" />
                </div>
              )}
              <button
                type="button"
                onClick={startVoiceSearch}
                className={`p-2 rounded-xl transition-all btn-tactile active:scale-95 ${
                  isListening
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                    : "text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                }`}
                title={t.voiceSearchTooltip}
                aria-label={t.voiceSearchTooltip}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="px-6 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20 flex items-center space-x-1.5 shrink-0 btn-tactile active:scale-95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">{t.searchWork}</span>
          </button>
        </form>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl card-premium text-xs">
        {/* Left: Work Type & Date Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider font-caption-refined">
            Type:
          </span>
          {[
            { id: "ALL", label: t.allTypes },
            { id: "TASK", label: t.task },
            { id: "SHIFT", label: t.shift },
            { id: "JOB", label: t.job },
          ].map((typeItem) => (
            <button
              key={typeItem.id}
              type="button"
              onClick={() => {
                setWorkType(typeItem.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all btn-tactile active:scale-95 ${
                workType === typeItem.id
                  ? "bg-blue-600 text-white shadow-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]"
                  : "bg-slate-100/80 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {typeItem.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider font-caption-refined">
            Date:
          </span>
          {[
            { label: "Anytime", value: "ALL" },
            { label: "Today", value: "TODAY" },
            { label: "Tomorrow", value: "TOMORROW" },
            { label: "Starting Soon", value: "STARTING_SOON" },
          ].map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => {
                setDateFilter(d.value as DiscoveryDateFilter);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all btn-tactile active:scale-95 ${
                dateFilter === d.value
                  ? "bg-slate-900 text-white shadow-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
                  : "bg-slate-100/80 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Right: Category, Sorting & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.length > 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                Category:
              </span>
              <select
                id="category-filter-select"
                name="categoryId"
                aria-label="Filter by Job Category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold focus:outline-none max-w-[140px]"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c: Category) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center space-x-1">
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              Sort:
            </span>
            <select
              id="sort-order-select"
              name="sortOption"
              aria-label="Sort Opportunities"
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value as DiscoverySortOption);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold focus:outline-none"
            >
              <option value="RECOMMENDED">{t.recommended}</option>
              <option value="NEAREST">{t.nearest}</option>
              <option value="STARTING_SOON">Starting Soon</option>
              <option value="HIGHEST_PAY">{t.highestPay}</option>
            </select>
          </div>

          {/* Desktop/Tablet View Mode Toggle (Split / List / Map) */}
          <div className="hidden lg:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "split"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Split Map & List View"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="List Only"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "map"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Map Only"
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Content: Split Map + Opportunity List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Opportunities List (6 or 12 Cols depending on viewMode) */}
        <div
          className={`${
            viewMode === "map"
              ? "hidden"
              : viewMode === "list"
              ? "lg:col-span-12"
              : "lg:col-span-6"
          } space-y-4`}
        >
          {/* Header Row: Result count & Reset */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold text-slate-800">
                Found{" "}
                <strong className="text-blue-600 font-mono">
                  {totalOpportunities}
                </strong>{" "}
                work {totalOpportunities === 1 ? "opportunity" : "opportunities"}{" "}
                within {radiusKm} km
              </span>
              {isLoading && (
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              )}
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Reset Filters
            </button>
          </div>

          {/* Job Card List */}
          {opportunities.length > 0 ? (
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <DiscoveredJobCard
                  key={opp.id}
                  opportunity={opp}
                  isSelected={opp.id === selectedOpportunityId}
                  userLocation={searchCenter}
                  onFocusOnMap={() => setSelectedOpportunityId(opp.id)}
                />
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-3 pt-6">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 disabled:opacity-40 shadow-xs hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 disabled:opacity-40 shadow-xs hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Rich Actionable Empty State */
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-card text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto border border-orange-100 shadow-xs">
                <Briefcase className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900 font-display">
                  No active work within {radiusKm} km right now
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                  Try expanding your search radius to 10 km or jump to popular Bangalore hubs below:
                </p>
              </div>

              {/* Quick Area Jump Buttons & Expand Radius */}
              <div className="space-y-3 pt-1 max-w-md mx-auto">
                {radiusKm < 10 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRadiusKm(10);
                      setCurrentPage(1);
                    }}
                    className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition-all shadow-md shadow-orange-600/20"
                  >
                    <Compass className="w-4 h-4" />
                    <span>{t.expandRadius}</span>
                  </button>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {BANGALORE_LOCALITIES.slice(0, 5).map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => {
                        setSearchCenter({ latitude: loc.latitude, longitude: loc.longitude });
                        setLocationName(loc.name);
                        setCurrentPage(1);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-900 border border-slate-200 text-xs font-bold transition-all"
                    >
                      {loc.name.split("/")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRadiusKm(10)}
                  className="px-5 py-2.5 rounded-2xl bg-orange-600 text-white font-black text-xs shadow-md shadow-orange-600/20 hover:bg-orange-700 transition-all"
                >
                  Expand to 10 KM Radius
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Leaflet Map (6 or 12 Cols) */}
        <div
          className={`${
            viewMode === "list"
              ? "hidden"
              : viewMode === "map"
              ? "lg:col-span-12 h-[650px]"
              : "lg:col-span-6 h-[580px] sticky top-24"
          } space-y-3`}
        >
          <DiscoveryMap
            center={searchCenter}
            radiusKm={radiusKm}
            opportunities={opportunities}
            selectedOpportunityId={selectedOpportunityId}
            onSelectOpportunity={(id) => setSelectedOpportunityId(id)}
          />

          {/* Selected Job Quick Preview Drawer */}
          {selectedOpportunity && (
            <div className="p-4 rounded-2xl bg-white border border-blue-200 shadow-float flex items-center justify-between gap-4 animate-fade-in">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-black text-[10px] uppercase">
                    {selectedOpportunity.workType}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {formatDistance(selectedOpportunity.distanceKm)} away
                  </span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 truncate">
                  {selectedOpportunity.title}
                </h4>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {selectedOpportunity.addressApproximate} •{" "}
                  {selectedOpportunity.workDate}
                </p>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className="text-right">
                  <div className="text-lg font-black text-slate-900 font-mono">
                    ₹{selectedOpportunity.paymentAmount}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">
                    {selectedOpportunity.durationHours} hrs
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowApplyModal(true)}
                  disabled={appliedJobs.has(selectedOpportunity.id)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-emerald-600 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all"
                >
                  {appliedJobs.has(selectedOpportunity.id)
                    ? "Applied"
                    : "1-Click Apply"}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOpportunityId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && selectedOpportunity && (
        <ApplyModal
          opportunity={selectedOpportunity}
          isOpen={showApplyModal}
          userLocation={searchCenter}
          onClose={() => setShowApplyModal(false)}
          onSuccess={() => {
            setAppliedJobs((prev) => new Set(prev).add(selectedOpportunity.id));
            setShowApplyModal(false);
          }}
        />
      )}
    </div>
  );
};
