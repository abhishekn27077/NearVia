import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Camera,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Eye,
  X,
  Clock,
  Shield,
  FileCheck,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { JobEvidence, JobEvidenceType } from "@nearvia/types";
import { apiFetch } from "../../utils/apiClient";

interface JobEvidenceGalleryProps {
  assignmentId: string;
  isReadOnly?: boolean;
}

const EVIDENCE_CATEGORIES: { type: JobEvidenceType; label: string; icon: any; color: string }[] = [
  { type: "BEFORE", label: "Before Work", icon: Camera, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { type: "AFTER", label: "After Work", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { type: "ARRIVAL", label: "Arrival Proof", icon: FileCheck, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { type: "ISSUE", label: "Work Issue", icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { type: "DAMAGE", label: "Pre-existing Damage", icon: Shield, color: "text-rose-600 bg-rose-50 border-rose-200" },
  { type: "RECEIPT", label: "Materials Receipt", icon: Receipt, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
];

/**
 * Resizes and compresses an image File or Blob to a compact base64 data URL
 * (Max 1200px dimension, JPEG quality 0.8) to maintain high visual clarity and fast loading.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Unable to read image file."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read selected file."));
    reader.readAsDataURL(file);
  });
}

export const JobEvidenceGallery: React.FC<JobEvidenceGalleryProps> = ({
  assignmentId,
  isReadOnly = false,
}) => {
  const [evidenceList, setEvidenceList] = useState<JobEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<JobEvidenceType>("BEFORE");
  const [notes, setNotes] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<JobEvidence | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchEvidence = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/assignments/${assignmentId}/evidence`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEvidenceList(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch evidence:", err);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  // Clean up live video stream on unmount or when camera turns off
  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsLiveCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopLiveCamera();
    };
  }, [stopLiveCamera]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Selected image is larger than 10MB. Please choose a smaller photo.");
      return;
    }

    try {
      setCameraError(null);
      const compressed = await compressImage(file);
      setPreviewUrl(compressed);
    } catch (err: any) {
      alert(err.message || "Failed to process photo.");
    }
  };

  const handleStartLiveCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        // Fall back to native camera input
        if (cameraInputRef.current) {
          cameraInputRef.current.click();
        } else {
          setCameraError("Camera device is not directly accessible in this browser. Please use file upload.");
        }
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      setIsLiveCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => console.warn("Video play error:", err));
        }
      }, 100);
    } catch (err: any) {
      console.warn("Live camera access error:", err);
      // Fall back to native file camera input
      setCameraError("Live camera access denied or unavailable. You can capture or choose a photo below.");
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  const handleCaptureLiveSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const snapshotUrl = canvas.toDataURL("image/jpeg", 0.85);
      setPreviewUrl(snapshotUrl);
    }
    stopLiveCamera();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl) {
      alert("Please capture or upload a photo first.");
      return;
    }

    try {
      setUploading(true);
      const res = await apiFetch(`/assignments/${assignmentId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceType: selectedType,
          fileUrl: previewUrl,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to save photo evidence.");
      }

      setPreviewUrl(null);
      setNotes("");
      setShowUploadForm(false);
      stopLiveCamera();
      await fetchEvidence();
    } catch (err: any) {
      alert(err.message || "Failed to save evidence photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleQuickDemoPhoto = (type: JobEvidenceType) => {
    setSelectedType(type);
    if (type === "BEFORE") {
      setPreviewUrl("https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80");
      setNotes("Initial area state before starting work");
    } else if (type === "AFTER") {
      setPreviewUrl("https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80");
      setNotes("Cleaned and sanitized area after completing tasks");
    } else if (type === "RECEIPT") {
      setPreviewUrl("https://images.unsplash.com/photo-1554415707-9e49016a44a6?auto=format&fit=crop&w=800&q=80");
      setNotes("Hardware supplies receipt");
    } else {
      setPreviewUrl("https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80");
      setNotes("Site verification snapshot");
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden Native File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-900 font-display flex items-center space-x-2">
            <Camera className="w-4 h-4 text-orange-600" />
            <span>Job Evidence & Photo Verification</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-medium">
            Optional before/after work verification photos. Auth-protected & privacy preserved.
          </p>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              if (showUploadForm) {
                stopLiveCamera();
              }
              setShowUploadForm(!showUploadForm);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{showUploadForm ? "Close Form" : "+ Add Photo"}</span>
          </button>
        )}
      </div>

      {/* Upload & Camera Capture Form Card */}
      {showUploadForm && (
        <form
          onSubmit={handleUploadSubmit}
          className="p-5 rounded-2xl bg-orange-50/50 border border-orange-200/80 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between border-b border-orange-200 pb-2">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Upload Work Photo
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemoPhoto("BEFORE")}
                className="px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-[10px] font-bold hover:bg-blue-200"
              >
                Sample Before
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoPhoto("AFTER")}
                className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold hover:bg-emerald-200"
              >
                Sample After
              </button>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
              Evidence Category *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EVIDENCE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedType === cat.type;
                return (
                  <button
                    key={cat.type}
                    type="button"
                    onClick={() => setSelectedType(cat.type)}
                    className={`p-2.5 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                      isSelected
                        ? `${cat.color} font-bold shadow-xs ring-2 ring-orange-500`
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Camera Error / Fallback Notice */}
          {cameraError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Live Camera Viewfinder */}
          {isLiveCameraActive ? (
            <div className="space-y-3 p-3 bg-slate-900 rounded-2xl">
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCaptureLiveSnapshot}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black flex items-center space-x-2 shadow-md"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Snapshot</span>
                </button>
                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center space-x-1.5"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Cancel Camera</span>
                </button>
              </div>
            </div>
          ) : previewUrl ? (
            /* Selected Photo Preview */
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Photo Preview
              </label>
              <div className="relative aspect-video max-h-64 w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Evidence preview"
                  className="max-h-full max-w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setPreviewUrl(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewUrl(null)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1"
                >
                  Remove / Retake
                </button>
              </div>
            </div>
          ) : (
            /* Action Buttons: Camera Capture or File Upload */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleStartLiveCamera}
                className="p-4 rounded-2xl bg-white border-2 border-dashed border-orange-300 hover:border-orange-500 hover:bg-orange-50 text-slate-700 transition flex flex-col items-center justify-center space-y-1.5 group"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-110 transition">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800">Capture with Camera</span>
                <span className="text-[10px] text-slate-500">Live device camera or mobile snapshot</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-2xl bg-white border-2 border-dashed border-slate-300 hover:border-slate-500 hover:bg-slate-50 text-slate-700 transition flex flex-col items-center justify-center space-y-1.5 group"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-110 transition">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800">Upload Photo File</span>
                <span className="text-[10px] text-slate-500">Select JPEG, PNG or WebP from disk</span>
              </button>
            </div>
          )}

          {/* Notes Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Notes / Description (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Work area cleaned, materials purchased..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-orange-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-2 pt-1 border-t border-orange-200/60">
            <button
              type="button"
              onClick={() => {
                stopLiveCamera();
                setShowUploadForm(false);
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !previewUrl}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-xs disabled:opacity-50 flex items-center space-x-1.5"
            >
              {uploading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{uploading ? "Saving Photo..." : "Save Evidence Photo"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Gallery Grid */}
      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400">Loading evidence photos...</div>
      ) : evidenceList.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-600">No verification photos attached</p>
          <p className="text-[11px] text-slate-400">
            Before and after photos provide optional proof of completed work.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {evidenceList.map((ev) => {
            const cat = EVIDENCE_CATEGORIES.find((c) => c.type === ev.evidenceType);
            return (
              <div
                key={ev.id}
                onClick={() => setActivePhoto(ev)}
                className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <div className="aspect-4/3 w-full bg-slate-100 overflow-hidden relative">
                  <img
                    src={ev.fileUrl}
                    alt={ev.evidenceType}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="p-2 rounded-full bg-white/90 text-slate-900 shadow-sm">
                      <Eye className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                <div className="p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        cat ? cat.color : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ev.evidenceType}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </span>
                  </div>
                  {ev.notes && (
                    <p className="text-[11px] text-slate-600 font-medium line-clamp-1">
                      {ev.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl space-y-4 p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-black uppercase">
                  {activePhoto.evidenceType}
                </span>
                <span className="text-xs text-slate-500">
                  Uploaded {new Date(activePhoto.createdAt).toLocaleString()} by {activePhoto.uploaderName || "Worker"}
                </span>
              </div>
              <button
                onClick={() => setActivePhoto(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center">
              <img
                src={activePhoto.fileUrl}
                alt={activePhoto.evidenceType}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {activePhoto.notes && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 font-medium">
                <strong>Note:</strong> {activePhoto.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
