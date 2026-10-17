import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  FileText,
  Building2,
  Sparkles,
  X,
  Lock,
  AlertTriangle,
  Upload,
  FileCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "@nearvia/types";
import { webConfig } from "../../config";

export const VerificationCenterPage: React.FC = () => {
  const { user, token, refreshProfile } = useAuth();

  const [idModalOpen, setIdModalOpen] = useState(false);
  const [idType, setIdType] = useState("AADHAAR");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idLoading, setIdLoading] = useState(false);
  const [idLoadingStep, setIdLoadingStep] = useState<string>("");
  const [idError, setIdError] = useState<string | null>(null);
  const [idSuccess, setIdSuccess] = useState(false);

  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessGstin, setBusinessGstin] = useState("");
  const [bizLoading, setBizLoading] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);
  const [bizSuccess, setBizSuccess] = useState(false);

  const [verifications, setVerifications] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${webConfig.apiBaseUrl}/verification/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setVerifications(data.data);
        }
      })
      .catch(() => {});
  }, [token, idSuccess, bizSuccess]);

  // Compute live verification states backed by DB
  const emailVerified = Boolean(user?.emailVerified);
  const phoneVerified = Boolean(user?.mobileVerified);
  
  const latestIdReq = verifications.find(
    (v) => (v.verificationType === "IDENTITY" || v.verificationType === "AADHAAR" || v.verificationType === "GOVERNMENT_ID")
  );
  const identityVerified = Boolean(user?.identityVerified);

  let idStatus: "VERIFIED" | "PENDING" | "RESUBMISSION_REQUIRED" | "REJECTED" | "NOT_VERIFIED" = "NOT_VERIFIED";
  if (identityVerified) {
    idStatus = "VERIFIED";
  } else if (latestIdReq?.status === "PENDING") {
    idStatus = "PENDING";
  } else if (latestIdReq?.status === "RESUBMISSION_REQUIRED") {
    idStatus = "RESUBMISSION_REQUIRED";
  } else if (latestIdReq?.status === "REJECTED") {
    idStatus = "REJECTED";
  }

  const pendingBizReq = verifications.find(
    (v) => (v.verificationType === "BUSINESS" || v.targetType === "BUSINESS") && v.status === "PENDING"
  );
  const bizVerified = false; // Backed by provider profile
  const bizStatus = bizVerified ? "VERIFIED" : pendingBizReq ? "PENDING" : "NOT_VERIFIED";

  // Calculate percentage
  const totalSteps = user?.role === UserRole.PROVIDER ? 4 : 3;
  let completedSteps = 0;
  if (emailVerified) completedSteps++;
  if (phoneVerified) completedSteps++;
  if (identityVerified) completedSteps++;
  if (user?.role === UserRole.PROVIDER && bizVerified) completedSteps++;

  const completionPercent = Math.round((completedSteps / totalSteps) * 100);

  const handleSubmitIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (idLoading) return;
    if (!idFile) {
      setIdError("Please select a document file to upload (JPEG, PNG, or PDF).");
      return;
    }

    if (idFile.size > 5 * 1024 * 1024) {
      setIdError("Document file exceeds the 5MB maximum file size limit.");
      return;
    }

    setIdLoading(true);
    setIdError(null);
    try {
      // Step 1: Request signed upload URL from API
      setIdLoadingStep("Preparing secure upload channel...");
      const urlRes = await fetch(`${webConfig.apiBaseUrl}/verification/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: user?.role === UserRole.PROVIDER ? "PROVIDER" : "WORKER",
          fileName: idFile.name,
          fileType: idFile.type,
          fileSize: idFile.size,
        }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok || !urlData.success) {
        throw new Error(urlData.error?.message || "Failed to generate secure upload URL.");
      }

      const { uploadUrl, storagePath } = urlData.data;

      // Step 2: Upload file directly to Supabase private storage via PUT
      setIdLoadingStep("Uploading document to private vault...");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": idFile.type,
        },
        body: idFile,
      });

      if (!putRes.ok) {
        throw new Error("Failed to upload document file to secure storage. Please try again.");
      }

      // Step 3: Submit verification record to backend
      setIdLoadingStep("Submitting for administrator review...");
      const targetType = user?.role === UserRole.WORKER ? "WORKER" : "PROVIDER";
      const submitRes = await fetch(`${webConfig.apiBaseUrl}/verification/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType,
          verificationType: "GOVERNMENT_ID",
          storagePath,
          documentRef: `${idType}:${storagePath}`,
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok || !submitData.success) {
        throw new Error(submitData.error?.message || "Failed to submit verification request.");
      }

      setIdSuccess(true);
      setIdModalOpen(false);
      setIdFile(null);
      if (refreshProfile) await refreshProfile();
    } catch (err: any) {
      setIdError(err.message || "An error occurred during submission.");
    } finally {
      setIdLoading(false);
      setIdLoadingStep("");
    }
  };

  const handleSubmitBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bizLoading) return;
    setBizLoading(true);
    setBizError(null);
    try {
      const res = await fetch(`${webConfig.apiBaseUrl}/verification/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: "BUSINESS",
          verificationType: "BUSINESS_REGISTRATION",
          documentRef: `BIZ_GSTIN_${businessGstin.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to submit business verification.");
      }
      setBizSuccess(true);
      setBusinessModalOpen(false);
    } catch (err: any) {
      setBizError(err.message);
    } finally {
      setBizLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-[#FAFAF9] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header & Overview */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Progressive Trust System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              Trust & Verification Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Verify your identity layers progressively. High trust scores unlock faster matching and verified badges.
            </p>
          </div>

          {/* Trust Score Meter */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-card flex items-center space-x-4">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-1000"
                  strokeDasharray={`${completionPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute font-black text-xs text-slate-900">{completionPercent}%</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Trust Level</div>
              <div className="text-sm font-black text-slate-900">
                {completedSteps} of {totalSteps} Verified
              </div>
            </div>
          </div>
        </div>

        {/* Verification Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Email Verification */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Mail className="w-6 h-6" />
              </div>
              {emailVerified ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>VERIFIED</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  PENDING CONFIRMATION
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Email Address (Primary V1)</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{user?.email}</p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your primary email is the authoritative account verification credential for NEARVIA V1 access.
            </p>
          </div>

          {/* 2. Mobile Phone Profile Info */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <Phone className="w-6 h-6" />
              </div>
              {phoneVerified ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>VERIFIED</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  OPTIONAL PROFILE INFO
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Mobile Phone Number</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {user?.phone || "No phone added (Optional)"}
              </p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Optional profile contact info for local coordination. SMS OTP is not required in NEARVIA V1.
            </p>
          </div>

          {/* 3. Manual Verification (Admin Reviewed) */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <FileText className="w-6 h-6" />
              </div>
              {idStatus === "VERIFIED" ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>MANUALLY VERIFIED BY ADMIN</span>
                </span>
              ) : idStatus === "PENDING" ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>IN REVIEW</span>
                </span>
              ) : idStatus === "RESUBMISSION_REQUIRED" ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-300 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>RESUBMISSION REQUIRED</span>
                </span>
              ) : idStatus === "REJECTED" ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                  <X className="w-3.5 h-3.5" />
                  <span>NOT APPROVED</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                  NOT SUBMITTED
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Government ID Verification</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Aadhaar, PAN, Voter ID, Driving License, or Passport
              </p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Verified by platform administrators via encrypted private storage. Never exposed publicly.
            </p>

            {idStatus === "RESUBMISSION_REQUIRED" && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Administrator Feedback:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900 font-medium">
                  {latestIdReq?.rejectionReason || "Please upload a clearer, uncropped photo of your document."}
                </p>
              </div>
            )}

            {idStatus === "REJECTED" && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Application Not Approved:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-900 font-medium">
                  {latestIdReq?.rejectionReason || "Your document could not be verified."}
                </p>
              </div>
            )}

            {idStatus === "NOT_VERIFIED" && (
              <button
                type="button"
                onClick={() => setIdModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Submit ID Document for Review
              </button>
            )}

            {(idStatus === "RESUBMISSION_REQUIRED" || idStatus === "REJECTED") && (
              <button
                type="button"
                onClick={() => setIdModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                {idStatus === "RESUBMISSION_REQUIRED" ? "Upload Corrected Document" : "Re-apply with New Document"}
              </button>
            )}
          </div>

          {/* 4. Business Verification (For Providers) */}
          {user?.role === UserRole.PROVIDER && (
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                  <Building2 className="w-6 h-6" />
                </div>
                {bizStatus === "VERIFIED" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>VERIFIED</span>
                  </span>
                ) : bizStatus === "PENDING" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>UNDER REVIEW</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                    OPTIONAL
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Business Registration</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">GSTIN / Shop & Establishment</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Unlock commercial hiring badges for warehouses, retail stores, and facilities management.
              </p>
              {bizStatus === "NOT_VERIFIED" && (
                <button
                  type="button"
                  onClick={() => setBusinessModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Verify Business
                </button>
              )}
            </div>
          )}
        </div>

        {/* Informational Banner */}
        <div className="p-5 rounded-3xl bg-orange-50/70 border border-orange-200/80 flex items-start space-x-3.5">
          <Sparkles className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-700">
            <div className="font-black text-slate-900">Email-First Freedom</div>
            <p className="leading-relaxed">
              You can explore and use NEARVIA right now with email authentication. Additional verifications can be added whenever you wish to boost your standing.
            </p>
          </div>
        </div>

        {/* ── MODALS ── */}

        {/* Identity / KYC Modal */}
        {idModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-display">
                    {idStatus === "RESUBMISSION_REQUIRED"
                      ? "Resubmit Identity Document"
                      : "Upload Identity Document"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Encrypted Supabase private storage. Never exposed publicly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIdModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {idStatus === "RESUBMISSION_REQUIRED" && latestIdReq?.rejectionReason && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Resubmission Instructions from Admin:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-900 font-medium">
                    {latestIdReq.rejectionReason}
                  </p>
                </div>
              )}

              {idError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {idError}
                </div>
              )}

              <form onSubmit={handleSubmitIdentity} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Document Type
                  </label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium text-sm focus:bg-white"
                  >
                    <option value="AADHAAR">Aadhaar Card (Front & Back)</option>
                    <option value="PAN">PAN Card</option>
                    <option value="VOTER_ID">Voter Identity Card</option>
                    <option value="DRIVING_LICENSE">Driving License</option>
                    <option value="PASSPORT">Passport</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Upload Document Image or PDF (Max 5MB)
                  </label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:border-slate-400 transition bg-slate-50/50">
                    <input
                      type="file"
                      id="kyc-file-upload"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setIdFile(file);
                        if (file && file.size > 5 * 1024 * 1024) {
                          setIdError("File exceeds 5MB size limit.");
                        } else {
                          setIdError(null);
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="kyc-file-upload" className="cursor-pointer block space-y-2">
                      {idFile ? (
                        <div className="flex items-center justify-center space-x-2 text-emerald-600 font-bold text-xs">
                          <FileCheck className="w-5 h-5" />
                          <span className="truncate max-w-[220px] text-slate-800">{idFile.name}</span>
                          <span className="text-slate-400 text-[10px]">
                            ({(idFile.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-center text-slate-400">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div className="text-xs font-bold text-slate-700">Click to select document file</div>
                          <p className="text-[10px] text-slate-400">JPEG, PNG, or PDF up to 5MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-[11px] text-blue-800 flex items-start space-x-2">
                  <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Direct Secure Storage: Files upload directly to an encrypted private Supabase storage bucket via temporary signed URL. Platform administrators review genuine documents before approval.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={idLoading || !idFile}
                  className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors disabled:opacity-50"
                >
                  {idLoading
                    ? idLoadingStep || "Uploading..."
                    : idStatus === "RESUBMISSION_REQUIRED"
                    ? "Resubmit Corrected Document"
                    : "Upload Document for Verification"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Business Modal */}
        {businessModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 font-display">
                  Business Verification
                </h3>
                <button
                  type="button"
                  onClick={() => setBusinessModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {bizError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {bizError}
                </div>
              )}

              <form onSubmit={handleSubmitBusiness} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Registered Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Metro Logistics Pvt Ltd"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium text-sm focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    GSTIN / Enterprise Registration Ref
                  </label>
                  <input
                    type="text"
                    required
                    value={businessGstin}
                    onChange={(e) => setBusinessGstin(e.target.value)}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-medium text-sm focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={bizLoading || !businessName || !businessGstin}
                  className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-colors"
                >
                  {bizLoading ? "Submitting..." : "Submit Business Details"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
