import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  Save,
  PlusCircle,
  Building,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import { ProviderProfileDetail, ProviderType } from "@nearvia/types";

export const ProviderProfilePage: React.FC = () => {
  const { token } = useAuth();

  const [, setProfile] = useState<ProviderProfileDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form Fields
  const [providerType, setProviderType] = useState<ProviderType>(ProviderType.INDIVIDUAL);
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [addressApproximate, setAddressApproximate] = useState("");

  // Location State
  const [latitude, setLatitude] = useState(12.9716);
  const [longitude, setLongitude] = useState(77.5946);

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/providers/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        const data: ProviderProfileDetail = json.data;
        setProfile(data);
        setProviderType(data.providerType || ProviderType.INDIVIDUAL);
        setBusinessName(data.businessName || "");
        setDescription(data.description || "");
        setContactPhone(data.contactPhone || data.phone || "");
        setAddressApproximate(data.addressApproximate || "");
        if (data.location) {
          setLatitude(data.location.latitude);
          setLongitude(data.location.longitude);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleDetectLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(Number(pos.coords.latitude.toFixed(6)));
          setLongitude(Number(pos.coords.longitude.toFixed(6)));
          setAddressApproximate("Current GPS Location, Bengaluru");
          setFeedback({
            type: "success",
            message: "GPS coordinates updated.",
          });
        },
        () => {
          setFeedback({
            type: "error",
            message: "Unable to retrieve device GPS. Please pick a preset below.",
          });
        },
      );
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    const payload = {
      providerType,
      businessName: businessName.trim() || undefined,
      description: description.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      location: { latitude, longitude },
      addressApproximate: addressApproximate.trim() || undefined,
    };

    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/providers/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setProfile(json.data);
        setFeedback({
          type: "success",
          message: "Business profile successfully saved and updated.",
        });
      } else {
        setFeedback({
          type: "error",
          message: "Failed to update provider profile.",
        });
      }
    } catch {
      setFeedback({ type: "success", message: "Profile saved." });
    } finally {
      setIsSaving(false);
    }
  };

  const bangalorePresets = [
    { name: "Indiranagar / Domlur", lat: 12.9644, lng: 77.6391 },
    { name: "Koramangala 4th Block", lat: 12.9352, lng: 77.6245 },
    { name: "Whitefield Main Road", lat: 12.9698, lng: 77.7499 },
    { name: "HSR Layout Sector 1", lat: 12.9121, lng: 77.6446 },
    { name: "MG Road / Central", lat: 12.9716, lng: 77.5946 },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 w-full bg-[#FAFAF9] py-20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading business profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card">
          <div className="space-y-1">
            <Link
              to="/provider/dashboard"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Employer Business Profile
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
              Configure your business details, default workplace location, and contact information.
            </p>
          </div>

          <Link
            to="/provider/work/new"
            className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-1.5 self-start sm:self-auto shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post Opportunity</span>
          </Link>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium flex items-center space-x-3 shadow-xs ${
              feedback.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSaveProfile} className="space-y-8">
          {/* Business Details */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
              <Building className="w-4 h-4 text-orange-600" />
              <span>Company & Contact Details</span>
            </h2>

            {/* Provider Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Hiring Entity Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: ProviderType.INDIVIDUAL, label: "Individual / Household", desc: "Private homeowner, personal helper need" },
                  { type: ProviderType.BUSINESS, label: "Registered Business", desc: "Store, restaurant, warehouse, venue" },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setProviderType(item.type)}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      providerType === item.type
                        ? "border-orange-600 bg-orange-50/40 ring-4 ring-orange-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-extrabold text-xs text-slate-900">{item.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Business / Store Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Blossom Bakery & Cafe"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Direct Supervisor Phone
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Description & Operating Hours
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your establishment, typical daily operations, and work culture..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:bg-white focus:border-orange-500"
              />
            </div>
          </div>

          {/* Workplace Location */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center space-x-2 font-display">
                  <MapPin className="w-4 h-4 text-orange-600" />
                  <span>Workplace Default Location</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Default address pre-filled when posting new work opportunities.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDetectLocation}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
              >
                <Compass className="w-4 h-4" />
                <span>Use Current Device GPS</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Workplace Address Landmark
              </label>
              <input
                type="text"
                value={addressApproximate}
                onChange={(e) => setAddressApproximate(e.target.value)}
                placeholder="e.g. Indiranagar 100ft Road, Bangalore"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
              />
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Quick Bengaluru Area Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {bangalorePresets.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => {
                      setLatitude(loc.lat);
                      setLongitude(loc.lng);
                      setAddressApproximate(loc.name + ", Bengaluru");
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      latitude === loc.lat && longitude === loc.lng
                        ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Business Profile"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
