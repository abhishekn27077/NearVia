import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  ArrowRight,
  Compass,
  Building,
  Search,
  IndianRupee,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { BANGALORE_LOCALITIES } from "@nearvia/shared";
import { webConfig } from "../config";
import {
  DiscoveredOpportunity,
  DiscoverySummaryResponse,
} from "@nearvia/types";
import gsap from "gsap";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLocality, setSelectedLocality] = useState(
    BANGALORE_LOCALITIES[0].name,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState<DiscoverySummaryResponse | null>(null);
  const [featuredOpportunities, setFeaturedOpportunities] = useState<
    DiscoveredOpportunity[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const heroRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  // Scroll reveal for sections
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll(".reveal-up").forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const loc =
      BANGALORE_LOCALITIES.find((l) => l.name === selectedLocality) ||
      BANGALORE_LOCALITIES[0];

    setIsLoading(true);
    Promise.all([
      fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/summary?lat=${loc.latitude}&lng=${loc.longitude}&radiusKm=5`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.data) setSummary(json.data);
        })
        .catch(() => {}),
      fetch(
        `${webConfig.apiBaseUrl}/work-opportunities/discover?lat=${loc.latitude}&lng=${loc.longitude}&radiusKm=5&limit=2`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.data) {
            setFeaturedOpportunities(json.data);
          }
        })
        .catch(() => {}),
    ]).finally(() => {
      setIsLoading(false);
    });
  }, [selectedLocality]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const textTargets = heroRef.current?.querySelectorAll(".hero-text-anim");
      if (textTargets && textTargets.length > 0) {
        gsap.from(textTargets, {
          y: 20,
          opacity: 0,
          duration: 0.75,
          stagger: 0.1,
          ease: "expo.out",
        });
      }

      const cardTargets = heroRef.current?.querySelectorAll(".hero-card-float");
      if (cardTargets && cardTargets.length > 0) {
        gsap.from(cardTargets, {
          y: 28,
          opacity: 0,
          duration: 0.85,
          delay: 0.2,
          stagger: 0.15,
          ease: "expo.out",
        });
      }
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(
      `/find-work?q=${encodeURIComponent(searchQuery)}&locality=${encodeURIComponent(selectedLocality)}`,
    );
  };

  const categoryMeta = [
    {
      name: "Kitchen & Restaurant",
      slug: "hospitality-kitchen",
      role: "Prep Cook, Dishwasher, Helper",
      image:
        "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
      accent: "border-orange-200 bg-orange-50/40",
      badge: "bg-orange-100 text-orange-800",
    },
    {
      name: "Warehouse & Logistics",
      slug: "logistics-delivery",
      role: "Package Sorter, Unloading, Moving",
      image:
        "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
      accent: "border-blue-200 bg-blue-50/40",
      badge: "bg-blue-100 text-blue-800",
    },
    {
      name: "Construction & Labor",
      slug: "construction-labor",
      role: "Masonry Helper, Site Assistant",
      image:
        "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
      accent: "border-amber-200 bg-amber-50/40",
      badge: "bg-amber-100 text-amber-800",
    },
    {
      name: "Retail & Sales",
      slug: "retail-sales",
      role: "Stocking, Counter Help, Inventory",
      image:
        "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80",
      accent: "border-pink-200 bg-pink-50/40",
      badge: "bg-pink-100 text-pink-800",
    },
    {
      name: "Cleaning & Housekeeping",
      slug: "cleaning-housekeeping",
      role: "Deep Clean, Office Helper, Janitorial",
      image:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
      accent: "border-emerald-200 bg-emerald-50/40",
      badge: "bg-emerald-100 text-emerald-800",
    },
    {
      name: "Events & Entertainment",
      slug: "events-entertainment",
      role: "Catering Setup, Usher, Stall Helper",
      image:
        "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80",
      accent: "border-purple-200 bg-purple-50/40",
      badge: "bg-purple-100 text-purple-800",
    },
    {
      name: "Repairs & Maintenance",
      slug: "repairs-maintenance",
      role: "Assistant Plumber, Electrician Helper",
      image:
        "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80",
      accent: "border-teal-200 bg-teal-50/40",
      badge: "bg-teal-100 text-teal-800",
    },
    {
      name: "Office & Admin Support",
      slug: "office-admin",
      role: "Scanning, Filing, Front Desk Relief",
      image:
        "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80",
      accent: "border-slate-200 bg-slate-50/40",
      badge: "bg-slate-100 text-slate-800",
    },
  ];

  const totalCount = summary?.totalOpportunities ?? 0;
  const minPay = summary?.minPayment ?? 500;
  const maxPay = summary?.maxPayment ?? 1200;

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF9] text-slate-900 overflow-hidden relative">
      {/* Ambient Gradient Orbs */}
      <div className="orb-gradient orb-orange" />
      <div className="orb-gradient orb-blue" />
      {/* ========================================================================= */}
      {/* 1. ASYMMETRIC PHOTOGRAPHIC HERO SECTION                                    */}
      {/* ========================================================================= */}
      <section
        ref={heroRef}
        className="relative pt-8 pb-16 lg:pt-14 lg:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Bold Editorial Headline + Search Console */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Hyperlocal Badge with Ambient Glow */}
            <div className="hero-text-anim inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-black tracking-wide uppercase shadow-xs shadow-orange-500/20 drop-shadow-[0_2px_8px_rgba(234,88,12,0.18)]">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-ping"></span>
              <span>
                {isLoading
                  ? "Scanning 5 KM Network..."
                  : `● ${totalCount} Opportunities within 5 KM • ${selectedLocality.split("/")[0]}`}
              </span>
            </div>

            {/* Main Headline with Optical Typography */}
            <h1 className="hero-text-anim text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 font-display-hero tracking-tight leading-[1.04]">
              Work near you.
              <br />
              <span className="relative inline-block text-orange-600">
                Earn today.
                <svg
                  aria-hidden="true"
                  viewBox="0 0 220 14"
                  className="absolute left-0 right-0 -bottom-2 w-full h-3 text-orange-300"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 8 Q 27 2, 55 6 T 110 8 T 165 6 T 218 9"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>
            </h1>

            <p className="hero-text-anim text-base sm:text-lg text-slate-600 font-medium font-body-refined leading-relaxed max-w-xl">
              Connect with immediate 1–2 hour micro-tasks, short shifts, and
              daily work happening within{" "}
              <strong className="text-slate-900">5 km</strong> of your
              doorstep. Typical payout{" "}
              <strong className="text-slate-900 font-mono">
                ₹{minPay}–₹{maxPay}
              </strong>
              , verified local businesses, guaranteed same-day payouts.
            </p>

            {/* High-Converting Search Console with Doppelrand */}
            <div className="hero-text-anim p-3 sm:p-4 rounded-3xl card-premium">
              <form
                onSubmit={handleSearchSubmit}
                className="flex flex-col sm:flex-row items-center gap-3"
              >
                {/* Locality Selector */}
                <div className="flex items-center space-x-2 w-full sm:w-2/5 bg-slate-50 px-3.5 py-3 rounded-2xl border border-slate-200">
                  <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <select
                    id="homepage-locality-select"
                    name="selectedLocality"
                    aria-label="Select City Locality"
                    value={selectedLocality}
                    onChange={(e) => setSelectedLocality(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none w-full cursor-pointer"
                  >
                    {BANGALORE_LOCALITIES.map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Keyword Search */}
                <div className="flex items-center space-x-2 w-full sm:flex-1 bg-slate-50 px-3.5 py-3 rounded-2xl border border-slate-200">
                  <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    id="homepage-keyword-input"
                    name="searchQuery"
                    aria-label="Search work keyword"
                    type="text"
                    placeholder="E.g. kitchen helper, loading, plumber..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none w-full"
                  />
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-transform duration-100 ease-out active:scale-95 shadow-md shadow-blue-600/25 flex items-center justify-center space-x-1.5 btn-tactile touch-target"
                >
                  <Compass className="w-4 h-4" />
                  <span>Find Work</span>
                </button>
              </form>

              {/* Popular Localities Chips */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400 font-medium mr-1">
                  Popular in Bengaluru:
                </span>
                {BANGALORE_LOCALITIES.slice(0, 4).map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => {
                      setSelectedLocality(loc.name);
                      navigate(
                        `/find-work?locality=${encodeURIComponent(loc.name)}`,
                      );
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-transform duration-100 ease-out active:scale-95 btn-magnetic select-none cursor-pointer"
                  >
                    {loc.name.split("/")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust Highlights */}
            <div className="hero-text-anim flex flex-wrap items-center gap-6 pt-2 text-xs font-semibold text-slate-600">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Businesses</span>
              </div>
              <div className="flex items-center space-x-2">
                <IndianRupee className="w-4 h-4 text-amber-600" />
                <span>Same-Day Settlement</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-orange-600" />
                <span>1-Tap Instant Apply</span>
              </div>
            </div>
          </div>

          {/* Right Column: Layered Photographic Montage with Live Opportunity Cards */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Main Background Image Card */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/5]">
                <img
                  src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80"
                  alt="Local marketplace active shifts"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20"></div>

                {/* Bottom Overlay Info on Main Image */}
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] uppercase mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse"></span>
                    <span>{totalCount} Opportunities Nearby</span>
                  </div>
                  <h3 className="text-lg font-black font-display">
                    {selectedLocality}
                  </h3>
                  <p className="text-xs text-slate-200">
                    Live 5 KM matching with immediate settlement
                  </p>
                </div>
              </div>

              {/* Floating Card 1: Top-Right Live Featured Opportunity */}
              {featuredOpportunities[0] ? (
                <div className="hero-card-float absolute -top-4 -right-4 sm:-right-6 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-float max-w-[210px] text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-extrabold text-[10px] truncate max-w-[110px]">
                      {featuredOpportunities[0].categoryName || "WORK"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {featuredOpportunities[0].distanceKm.toFixed(1)} KM
                    </span>
                  </div>
                  <div className="text-base font-black text-slate-900 font-mono">
                    ₹{featuredOpportunities[0].paymentAmount}{" "}
                    <span className="text-[11px] font-normal text-slate-500">
                      / {featuredOpportunities[0].durationHours}h
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium mt-1 truncate">
                    {featuredOpportunities[0].title}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-100">
                    <span className="text-emerald-700 font-bold truncate max-w-[100px]">
                      ✓ {featuredOpportunities[0].providerName || "Verified"}
                    </span>
                    <Link
                      to={`/find-work?selected=${featuredOpportunities[0].id}&locality=${encodeURIComponent(selectedLocality)}`}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Apply
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* Floating Card 2: Bottom-Left Live Featured Opportunity */}
              {featuredOpportunities[1] ? (
                <div className="hero-card-float absolute -bottom-6 -left-4 sm:-left-6 bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-float max-w-[220px] text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-extrabold text-[10px] truncate max-w-[110px]">
                      {featuredOpportunities[1].categoryName || "WORK"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {featuredOpportunities[1].distanceKm.toFixed(1)} KM
                    </span>
                  </div>
                  <div className="text-base font-black text-amber-400 font-mono">
                    ₹{featuredOpportunities[1].paymentAmount}{" "}
                    <span className="text-[11px] font-normal text-slate-300">
                      / {featuredOpportunities[1].durationHours}h
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium mt-1 truncate">
                    {featuredOpportunities[1].title}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800">
                    <span className="text-emerald-400 font-bold">
                      {featuredOpportunities[1].workersNeeded} Needed
                    </span>
                    <Link
                      to={`/find-work?selected=${featuredOpportunities[1].id}&locality=${encodeURIComponent(selectedLocality)}`}
                      className="text-orange-400 font-bold hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. PHOTOGRAPHIC CATEGORY DISCOVERY TILES (LIVE DATA INTEGRATION)          */}
      {/* ========================================================================= */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full reveal-up" ref={categoriesRef}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div className="space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-orange-600">
              Live Categorized Work • 5 KM Radius
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 font-display-title tracking-tight">
              Popular Work Categories
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Real-time available shifts and micro-tasks active around{" "}
              <strong className="text-slate-800">
                {selectedLocality.split("/")[0]}
              </strong>
              .
            </p>
          </div>

          <Link
            to={`/find-work?locality=${encodeURIComponent(selectedLocality)}`}
            className="inline-flex items-center space-x-1 text-xs font-extrabold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>Explore All Opportunities</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 8 Category Tiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categoryMeta.map((cat) => {
            const catStat = summary?.categoryStats.find(
              (s) => s.categorySlug === cat.slug || s.categoryName === cat.name,
            );
            const count = catStat?.count ?? 0;
            const catPay =
              catStat && catStat.count > 0 && catStat.minPayment > 0
                ? `₹${catStat.minPayment}–₹${catStat.maxPayment}`
                : "₹500–₹1,200";

            return (
              <div
                key={cat.slug}
                onClick={() =>
                  navigate(
                    `/find-work?categoryId=${catStat?.categoryId || ""}&locality=${encodeURIComponent(selectedLocality)}`,
                  )
                }
                className="card-premium group overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Photo Container */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

                    {/* Count Badge on Image */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${cat.badge}`}
                      >
                        {count > 0 ? `${count} active` : "Available nearby"}
                      </span>
                      <span className="text-white font-mono font-black text-xs drop-shadow-md">
                        {catPay}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-1">
                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {cat.role}
                    </p>
                  </div>
                </div>

                {/* Card Footer Link */}
                <div className="px-4 pb-4 pt-1 flex items-center justify-between text-xs font-bold text-blue-600 border-t border-slate-100">
                  <span>Explore Work</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. 4-STEP VISUAL HOW IT WORKS SECTION                                      */}
      {/* ========================================================================= */}
      <section className="py-20 bg-white border-y border-slate-200 reveal-up" ref={stepsRef}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-blue-600">
              Frictionless Local Work
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 font-display tracking-tight">
              From Search to Payout in 4 Steps
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              No endless interviews or lengthy resumes. Transparent pay,
              immediate local matching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="card-premium p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-mono font-black text-base flex items-center justify-center shadow-md">
                01
              </div>
              <h3 className="font-extrabold text-base text-slate-900">
                Discover in 5 KM
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Browse real-time tasks and shifts within walking or short
                transit distance in your neighborhood.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-premium p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white font-mono font-black text-base flex items-center justify-center shadow-md">
                02
              </div>
              <h3 className="font-extrabold text-base text-slate-900">
                1-Click Quick Apply
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Apply instantly with your verified skills and availability.
                Employers confirm within minutes.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-premium p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-mono font-black text-base flex items-center justify-center shadow-md">
                03
              </div>
              <h3 className="font-extrabold text-base text-slate-900">
                GPS Check-In & Work
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Arrive on site, check in via geo-verification, complete the
                scheduled task or shift.
              </p>
            </div>

            {/* Step 4 */}
            <div className="card-premium p-6 space-y-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-mono font-black text-base flex items-center justify-center shadow-md">
                04
              </div>
              <h3 className="font-extrabold text-base text-slate-900">
                Same-Day Settlement
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Work approved by employer $\rightarrow$ receive direct bank or
                UPI payment on the same day.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. THREE PERSONA ACTION MODULES                                            */}
      {/* ========================================================================= */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full reveal-up">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Workers */}
          <div className="card-premium p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 font-display">
                Looking for Work?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Find shifts today. Set your availability, choose your trade, and
                earn with transparent payouts.
              </p>
            </div>
            <Link
              to="/find-work"
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs text-center transition-all shadow-md shadow-blue-600/20"
            >
              Browse 5 KM Work Opportunities
            </Link>
          </div>

          {/* Card 2: Employers */}
          <div className="card-premium p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <Building className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 font-display">
                Need Reliable Staff?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Post tasks or shifts in under 60 seconds. Match with verified,
                rated workers ready to start nearby.
              </p>
            </div>
            <Link
              to="/provider/work/new"
              className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs text-center transition-all shadow-md shadow-orange-600/20"
            >
              Post Work in 60 Seconds
            </Link>
          </div>

          {/* Card 3: Community Agents */}
          <div className="card-premium p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 font-display">
                Community Agent?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Help local workers find tasks, verify profiles, and manage
                assisted applications in your neighborhood.
              </p>
            </div>
            <Link
              to="/agent/dashboard"
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs text-center transition-all shadow-md"
            >
              Access Agent Portal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
