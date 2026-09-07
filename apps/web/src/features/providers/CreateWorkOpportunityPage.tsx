import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Layers,
  Users,
  MapPin,
  Clock,
  IndianRupee,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  Check,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { webConfig } from "../../config";
import {
  WorkType,
  UrgencyLevel,
  PaymentType,
  WorkOpportunityStatus,
  Category,
  Skill,
} from "@nearvia/types";
import { RequiredSkillItemInput } from "@nearvia/validation";
import { formatCurrencyINR, formatDateLabel, formatTimeLabel } from "../../utils";
import { LocationPicker } from "../../components/location/LocationPicker";
import { SmartJobDraftModal, MarketWageGuidance } from "../intelligence";
import { NLJobParseResult } from "@nearvia/types";

export const CreateWorkOpportunityPage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Taxonomy Lists
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogSkills, setCatalogSkills] = useState<Skill[]>([]);

  // Step 1: Work Type & Basics
  const [workType, setWorkType] = useState<WorkType>(WorkType.TASK);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Workers & Skills
  const [workersNeeded, setWorkersNeeded] = useState<number>(1);
  const [minExperienceYears, setMinExperienceYears] = useState<number>(0);
  const [selectedSkills, setSelectedSkills] = useState<RequiredSkillItemInput[]>([]);
  const [currentSkillId, setCurrentSkillId] = useState("");
  const [currentSkillExp, setCurrentSkillExp] = useState(1);

  // Step 3: Schedule & Location
  const [workDate, setWorkDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0] || "2026-08-30";
  });
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [durationHours, setDurationHours] = useState<number>(2);
  const [latitude, setLatitude] = useState(12.9784);
  const [longitude, setLongitude] = useState(77.6408);
  const [addressApproximate, setAddressApproximate] = useState(
    "Indiranagar 100ft Road, Bangalore",
  );

  // Step 4: Compensation & Work Details
  const [paymentAmount, setPaymentAmount] = useState<number | "">(500);
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.FIXED);
  const [urgency, setUrgency] = useState<UrgencyLevel>(UrgencyLevel.NORMAL);
  const [toolsProvided, setToolsProvided] = useState<boolean>(true);
  const [orientationProvided, setOrientationProvided] = useState<boolean>(true);
  const [responsibilities, setResponsibilities] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isSmartDraftOpen, setIsSmartDraftOpen] = useState(false);

  const handleApplySmartDraft = (draft: NLJobParseResult) => {
    if (draft.title) setTitle(draft.title);
    if (draft.categoryId) setCategoryId(draft.categoryId);
    if (draft.description) setDescription(draft.description);
    if (draft.workType) setWorkType(draft.workType);
    if (draft.urgency) setUrgency(draft.urgency);
    if (draft.workDate) setWorkDate(draft.workDate);
    if (draft.startTime) setStartTime(draft.startTime.slice(0, 5));
    if (draft.endTime) setEndTime(draft.endTime.slice(0, 5));
    if (draft.durationHours) setDurationHours(draft.durationHours);
    if (draft.suggestedWage) setPaymentAmount(draft.suggestedWage);
    if (draft.paymentType) setPaymentType(draft.paymentType);
    if (draft.responsibilities && draft.responsibilities.length > 0) {
      setResponsibilities(draft.responsibilities.join("\n"));
    }
    if (draft.instructions) setInstructions(draft.instructions);
    if (draft.requiredSkills && draft.requiredSkills.length > 0) {
      setSelectedSkills(
        draft.requiredSkills.map((s) => ({
          skillId: s.skillId,
          minExperienceYears: s.minExperienceYears || 0,
          isRequired: true,
        }))
      );
    }
    setFeedback({
      type: "success",
      message: `✨ Form auto-populated with ${draft.title} (${Math.round(draft.confidence * 100)}% AI confidence)`,
    });
  };

  useEffect(() => {
    loadTaxonomies();
  }, []);

  // Calculate duration whenever times change
  useEffect(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      if (
        sh !== undefined &&
        sm !== undefined &&
        eh !== undefined &&
        em !== undefined
      ) {
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        if (endMinutes > startMinutes) {
          const diffHours = (endMinutes - startMinutes) / 60;
          setDurationHours(Math.round(diffHours * 10) / 10);
        }
      }
    }
  }, [startTime, endTime]);

  const loadTaxonomies = async () => {
    try {
      const [catRes, skillRes] = await Promise.all([
        fetch(`${webConfig.apiBaseUrl}/categories`),
        fetch(`${webConfig.apiBaseUrl}/skills`),
      ]);

      if (catRes.ok) {
        const catJson = await catRes.json();
        setCategories(catJson.data || []);
        if (catJson.data?.length > 0) {
          setCategoryId(catJson.data[0].id);
        }
      }

      if (skillRes.ok) {
        const skillJson = await skillRes.json();
        setCatalogSkills(skillJson.data || []);
      }
    } catch {
      // Fallback seed lists
      const fallbackCats: Category[] = [
        {
          id: "a0000001-0000-0000-0000-000000000001",
          name: "Restaurant & Hospitality",
          slug: "restaurant-hospitality",
          displayOrder: 1,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "a0000001-0000-0000-0000-000000000002",
          name: "Retail & Shop Assistance",
          slug: "retail-shop-assistance",
          displayOrder: 2,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "a0000001-0000-0000-0000-000000000003",
          name: "Warehouse & Logistics",
          slug: "warehouse-logistics",
          displayOrder: 3,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ];
      setCategories(fallbackCats);
      setCategoryId(fallbackCats[0]?.id || "");
    }
  };

  const handleAddSkill = () => {
    if (!currentSkillId) return;
    const exists = selectedSkills.some((s) => s.skillId === currentSkillId);
    if (exists) return;

    setSelectedSkills([
      ...selectedSkills,
      {
        skillId: currentSkillId,
        minExperienceYears: currentSkillExp,
        isRequired: true,
      },
    ]);
    setCurrentSkillId("");
  };

  const handleRemoveSkill = (skillId: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s.skillId !== skillId));
  };

  const validateStep = (step: number): boolean => {
    setFeedback(null);
    if (step === 1) {
      if (!title.trim() || title.length < 5) {
        setFeedback({
          type: "error",
          message: "Please enter a descriptive work title (minimum 5 characters).",
        });
        return false;
      }
      if (!categoryId) {
        setFeedback({
          type: "error",
          message: "Please select an active work category.",
        });
        return false;
      }
      if (!description.trim() || description.length < 10) {
        setFeedback({
          type: "error",
          message: "Please describe the work requirements (minimum 10 characters).",
        });
        return false;
      }
    }

    if (step === 3) {
      if (!workDate) {
        setFeedback({
          type: "error",
          message: "Please choose a scheduled work date.",
        });
        return false;
      }
      if (!addressApproximate.trim()) {
        setFeedback({
          type: "error",
          message: "Please specify an approximate landmark address.",
        });
        return false;
      }
    }

    if (step === 4) {
      if (!paymentAmount || Number(paymentAmount) <= 0) {
        setFeedback({
          type: "error",
          message: "Please enter a valid compensation amount (INR).",
        });
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (targetStatus: WorkOpportunityStatus) => {
    if (!validateStep(1) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const payload = {
      title: title.trim(),
      categoryId,
      description: description.trim(),
      workType,
      urgency,
      workersNeeded: Number(workersNeeded),
      minExperienceYears: Number(minExperienceYears),
      location: { latitude, longitude },
      addressApproximate: addressApproximate.trim(),
      workDate,
      startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
      endTime: endTime.length === 5 ? `${endTime}:00` : endTime,
      durationHours: Number(durationHours),
      paymentAmount: Number(paymentAmount),
      paymentType,
      currency: "INR",
      responsibilities: responsibilities.trim() || undefined,
      instructions: instructions.trim() || undefined,
      toolsProvided,
      orientationProvided,
      skills: selectedSkills,
      status: targetStatus,
    };

    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/work-opportunities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        navigate(`/provider/work/${json.data.id}`);
      } else {
        const errJson = await res.json();
        setFeedback({
          type: "error",
          message: errJson.error?.message || "Failed to create work opportunity.",
        });
      }
    } catch {
      const mockId = `wo_${Date.now()}`;
      navigate(`/provider/work/${mockId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              to="/provider/work"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to My Postings</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display-title">
              Post Work Opportunity
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Publish a discrete task, shift, or short-term work for instant 5 km radius worker discovery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsSmartDraftOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Smart AI / Voice Auto-Draft</span>
            </button>
            <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Instant 5 KM Matching</span>
            </div>
          </div>
        </div>

        {/* Step Indicator Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          {[
            { num: 1, label: "Type & Category", icon: Layers },
            { num: 2, label: "Workers & Skills", icon: Users },
            { num: 3, label: "Schedule & Place", icon: MapPin },
            { num: 4, label: "Pay & Details", icon: IndianRupee },
            { num: 5, label: "Preview & Post", icon: CheckCircle2 },
          ].map((s) => {
            const Icon = s.icon;
            const isActive = currentStep === s.num;
            const isDone = currentStep > s.num;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setCurrentStep(s.num)}
                className={`p-3 sm:p-4 rounded-2xl border text-left transition-all btn-tactile active:scale-95 flex flex-col justify-between ${
                  isActive
                    ? "bg-white border-orange-500 shadow-md ring-2 ring-orange-500/10 text-slate-900 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]"
                    : isDone
                      ? "bg-white/80 border-slate-200 text-slate-700 hover:bg-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)]"
                      : "bg-slate-100/60 border-slate-200/60 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? "bg-orange-600 text-white"
                        : isDone
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </span>
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-orange-600" : isDone ? "text-emerald-600" : "text-slate-400"
                    }`}
                  />
                </div>
                <div className="text-xs font-bold truncate mt-1">{s.label}</div>
              </button>
            );
          })}
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

        {/* Form Container */}
        <div className="p-6 sm:p-10 rounded-3xl card-premium space-y-8">
          {/* STEP 1: Work Type & Category */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Quick 1-Click Templates */}
              <div className="p-5 rounded-2xl bg-orange-50/70 border border-orange-200/80 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-extrabold text-orange-900">
                  <Zap className="w-4 h-4 text-orange-600" />
                  <span>Popular 1-Tap Templates:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: "🍳 Restaurant Helper",
                      type: WorkType.SHIFT,
                      title: "Restaurant kitchen helper & prep assistance",
                      description: "Help with dinner prep, cleaning counters, and managing dishwashing during peak evening hours.",
                      responsibilities: "Clean dishes, prep vegetables, maintain clean workstation.",
                      instructions: "Wear non-slip footwear. Apron will be provided.",
                      duration: 4,
                      amount: 700,
                      workers: 2,
                    },
                    {
                      label: "📦 Warehouse Loading",
                      type: WorkType.SHIFT,
                      title: "Warehouse inventory loading & stacking",
                      description: "Unload incoming courier boxes and neatly stack cartons on designated storage racks.",
                      responsibilities: "Lift and stack boxes up to 15 kg onto storage pallets.",
                      instructions: "Report to Gate 2 security. Safety gloves provided.",
                      duration: 5,
                      amount: 950,
                      workers: 3,
                    },
                    {
                      label: "🔨 Construction Helper",
                      type: WorkType.JOB,
                      title: "Site helper for brick & cement transport",
                      description: "Assisting masonry team with moving bricks, mortar mix, and general site cleanup.",
                      responsibilities: "Carry building materials and assist masons.",
                      instructions: "Wear sturdy shoes. Helmet and gloves provided on-site.",
                      duration: 8,
                      amount: 1200,
                      workers: 2,
                    },
                    {
                      label: "🎉 Event Staff",
                      type: WorkType.SHIFT,
                      title: "Event banquet food serving & table setup",
                      description: "Serving buffet stations, refilling water glasses, and clearing tables during banquet.",
                      responsibilities: "Buffet service and maintaining clean banquet tables.",
                      instructions: "Formal black trousers and white shirt required.",
                      duration: 6,
                      amount: 1000,
                      workers: 4,
                    },
                    {
                      label: "✨ Deep Cleaning",
                      type: WorkType.TASK,
                      title: "Deep cleaning & floor scrubbing",
                      description: "Complete floor mopping, window wiping, and balcony scrubbing for commercial unit.",
                      responsibilities: "Clean floors, glass windows, and washroom tiles.",
                      instructions: "All cleaning detergents and mops provided.",
                      duration: 3,
                      amount: 600,
                      workers: 1,
                    },
                    {
                      label: "🛍️ Retail Helper",
                      type: WorkType.TASK,
                      title: "Shop inventory unpacking & shelf arrangement",
                      description: "Organize newly arrived garments onto display hangers and tag items.",
                      responsibilities: "Unpack apparel boxes and hang on display racks.",
                      instructions: "Basic arithmetic and neat folding required.",
                      duration: 3,
                      amount: 550,
                      workers: 1,
                    },
                  ].map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setWorkType(tpl.type);
                        setTitle(tpl.title);
                        setDescription(tpl.description);
                        setResponsibilities(tpl.responsibilities);
                        setInstructions(tpl.instructions);
                        setDurationHours(tpl.duration);
                        setPaymentAmount(tpl.amount);
                        setWorkersNeeded(tpl.workers);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-orange-100/60 border border-orange-200 text-slate-800 text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5"
                    >
                      <span>{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Work Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Work Opportunity Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      type: WorkType.TASK,
                      title: "TASK (1–3 Hours)",
                      desc: "Discrete micro-job (e.g. Move 20 boxes, shelf arrangement, quick repair).",
                      badge: "Fast Settlement",
                    },
                    {
                      type: WorkType.SHIFT,
                      title: "SHIFT (4–8 Hours)",
                      desc: "Defined working session (e.g. Evening restaurant shift, peak warehouse loading).",
                      badge: "High Demand",
                    },
                    {
                      type: WorkType.JOB,
                      title: "JOB (1+ Days)",
                      desc: "Multi-day temporary replacement or seasonal project requirement.",
                      badge: "Extended",
                    },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setWorkType(item.type)}
                      className={`p-5 rounded-2xl border-2 text-left transition-all ${
                        workType === item.type
                          ? "border-orange-600 bg-orange-50/40 ring-4 ring-orange-500/10"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-black text-slate-900 font-display">
                          {item.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {item.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Work Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Work Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bakery Helper & Counter Packaging Assistant"
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Work Category *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                >
                  <option value="" disabled>Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Detailed Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Detailed Work Description *
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the task details, physical requirements, working conditions, safety gear, and goals..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Workers & Skills */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Workers Needed *
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={workersNeeded}
                      onChange={(e) => setWorkersNeeded(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-28 px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-base focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                    />
                    <span className="text-xs text-slate-500 font-medium">
                      verified workers to hire
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Minimum Experience Required
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={minExperienceYears}
                      onChange={(e) => setMinExperienceYears(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-28 px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-base focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                    />
                    <span className="text-xs text-slate-500 font-medium">
                      years in trade (0 = no prior experience needed)
                    </span>
                  </div>
                </div>
              </div>

              {/* Skills Requirement */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Required Trade Skills (Optional)
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                  <select
                    value={currentSkillId}
                    onChange={(e) => setCurrentSkillId(e.target.value)}
                    className="flex-1 px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
                  >
                    <option value="">Select a skill from catalog...</option>
                    {catalogSkills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={currentSkillExp}
                      onChange={(e) => setCurrentSkillExp(parseFloat(e.target.value) || 1)}
                      className="w-20 px-3 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold"
                      title="Years Exp"
                    />
                    <span className="text-xs text-slate-500 font-semibold">yrs</span>

                    <button
                      type="button"
                      onClick={handleAddSkill}
                      disabled={!currentSkillId}
                      className="px-4 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Skill</span>
                    </button>
                  </div>
                </div>

                {/* Selected Skills Chips */}
                {selectedSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedSkills.map((sk) => {
                      const skillObj = catalogSkills.find((s) => s.id === sk.skillId);
                      return (
                        <span
                          key={sk.skillId}
                          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs font-bold"
                        >
                          <span>{skillObj?.name || sk.skillId}</span>
                          <span className="text-[10px] text-orange-600 font-extrabold">
                            ({sk.minExperienceYears}y exp)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(sk.skillId)}
                            className="text-orange-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No specialized trade skills selected. Open to all verified general assistance workers.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Schedule & Location */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Work Date *
                  </label>
                  <input
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span>Calculated Shift Duration:</span>
                </div>
                <span className="text-sm font-black text-slate-900">
                  {durationHours} Hours
                </span>
              </div>

              {/* Interactive Workplace Location Picker */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Workplace Location & Geocoding *
                </label>
                <LocationPicker
                  initialLatitude={latitude}
                  initialLongitude={longitude}
                  initialAddress={addressApproximate}
                  onLocationSelect={(loc) => {
                    setLatitude(loc.latitude);
                    setLongitude(loc.longitude);
                    setAddressApproximate(loc.address);
                  }}
                />
              </div>
            </div>
          )}

          {/* STEP 4: Compensation & Work Details */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Amount (INR) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 font-bold">
                      ₹
                    </div>
                    <input
                      type="number"
                      min={100}
                      step={50}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="500"
                      className="w-full pl-8 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-black text-lg focus:bg-white focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Payment Structure *
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:bg-white focus:border-orange-500"
                  >
                    <option value={PaymentType.FIXED}>FIXED (Lump-sum Payout)</option>
                    <option value={PaymentType.HOURLY}>HOURLY (Rate per Hour)</option>
                    <option value={PaymentType.DAILY}>DAILY (Daily Wage Rate)</option>
                  </select>
                </div>
              </div>

              {/* Real-Time Category Market Wage Benchmark */}
              <MarketWageGuidance
                categoryId={categoryId}
                currentWage={Number(paymentAmount) || 0}
                onSelectSuggestedRate={(rate) => setPaymentAmount(rate)}
              />

              {/* Urgency Level */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Urgency Level
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { level: UrgencyLevel.NORMAL, label: "Normal (Scheduled)", desc: "Standard matching" },
                    { level: UrgencyLevel.URGENT, label: "Urgent (Within 4h)", desc: "Priority broadcast" },
                    { level: UrgencyLevel.IMMEDIATE, label: "Immediate (Now)", desc: "Emergency live dispatch" },
                  ].map((u) => (
                    <button
                      key={u.level}
                      type="button"
                      onClick={() => setUrgency(u.level)}
                      className={`p-3.5 rounded-2xl border text-center transition-all ${
                        urgency === u.level
                          ? u.level === UrgencyLevel.URGENT
                            ? "bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20 font-bold"
                            : "bg-orange-50 border-orange-500 text-orange-900 ring-2 ring-orange-500/20 font-bold"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white"
                      }`}
                    >
                      <div className="text-xs font-bold">{u.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{u.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Responsibilities & Instructions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Key Responsibilities
                  </label>
                  <textarea
                    rows={3}
                    value={responsibilities}
                    onChange={(e) => setResponsibilities(e.target.value)}
                    placeholder="e.g. Unpack bakery trays, count inventory boxes, display freshly baked goods..."
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Worker Instructions / Dress Code
                  </label>
                  <textarea
                    rows={3}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Wear comfortable shoes. Apron provided on-site. Report to Ramesh Kumar."
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Checkboxes for Tools & Orientation */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toolsProvided}
                    onChange={(e) => setToolsProvided(e.target.checked)}
                    className="w-5 h-5 rounded-lg text-orange-600 focus:ring-orange-500 border-slate-300"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Tools Provided On-Site</div>
                    <div className="text-[11px] text-slate-500">Worker does not need own equipment</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={orientationProvided}
                    onChange={(e) => setOrientationProvided(e.target.checked)}
                    className="w-5 h-5 rounded-lg text-orange-600 focus:ring-orange-500 border-slate-300"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">On-Site Orientation Provided</div>
                    <div className="text-[11px] text-slate-500">Quick 10-min briefing before shift begins</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 5: Preview & Post */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-extrabold">
                        {workType}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
                        {selectedCategoryObj?.name || "General"}
                      </span>
                      {urgency === UrgencyLevel.URGENT && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-extrabold">
                          URGENT
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
                      {title || "Untitled Work Opportunity"}
                    </h2>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-black text-emerald-600">
                      {formatCurrencyINR(paymentAmount)}
                    </div>
                    <div className="text-xs text-slate-500 font-bold uppercase">
                      {paymentType} Payout per Worker
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  {description || "No description provided."}
                </p>

                {/* Key Summary Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Workers</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">{workersNeeded} Needed</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Date</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">{formatDateLabel(workDate)}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Timing</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {formatTimeLabel(startTime)} – {formatTimeLabel(endTime)} ({durationHours}h)
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Total Budget</div>
                    <div className="text-sm font-black text-emerald-600 mt-0.5">
                      {formatCurrencyINR(Number(paymentAmount || 0) * workersNeeded)}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center space-x-3 text-xs text-slate-700">
                  <MapPin className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">{addressApproximate}</div>
                    <div className="text-slate-500 text-[11px]">
                      Hyperlocal Location Pin • Discovered by nearby workers within 5.0 KM
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button Navigation Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous Step</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-md shadow-orange-600/20 flex items-center justify-center space-x-2"
                >
                  <span>Continue to Step {currentStep + 1}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSubmit(WorkOpportunityStatus.DRAFT)}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit(WorkOpportunityStatus.PUBLISHED)}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition-all shadow-lg shadow-orange-600/25 flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span>Publishing to 5 KM...</span>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Publish Work Opportunity</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Natural-Language Job Draft Modal */}
      <SmartJobDraftModal
        isOpen={isSmartDraftOpen}
        onClose={() => setIsSmartDraftOpen(false)}
        onApplyDraft={handleApplySmartDraft}
      />
    </div>
  );
};
