import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { JobEvidence, JobEvidenceType } from "@nearvia/types";
import { webConfig } from "../../config";
import { useAuth } from "../../context/AuthContext";

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

export const JobEvidenceGallery: React.FC<JobEvidenceGalleryProps> = ({
  assignmentId,
  isReadOnly = false,
}) => {
  const { token } = useAuth();
  const [evidenceList, setEvidenceList] = useState<JobEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<JobEvidenceType>("BEFORE");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [activePhoto, setActivePhoto] = useState<JobEvidence | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const fetchEvidence = useCallback(async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${assignmentId}/evidence`, {
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEvidenceList(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch evidence:", err);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, token]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl.trim()) {
      alert("Please provide a photo image URL.");
      return;
    }

    try {
      setUploading(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${webConfig.apiBaseUrl}/assignments/${assignmentId}/evidence`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          evidenceType: selectedType,
          fileUrl: photoUrl.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to upload photo evidence.");
      }

      setPhotoUrl("");
      setNotes("");
      setShowUploadForm(false);
      await fetchEvidence();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleQuickDemoPhoto = (type: JobEvidenceType) => {
    setSelectedType(type);
    if (type === "BEFORE") {
      setPhotoUrl("https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80");
      setNotes("Initial area state before starting work");
    } else if (type === "AFTER") {
      setPhotoUrl("https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80");
      setNotes("Cleaned and sanitized area after completing tasks");
    } else if (type === "RECEIPT") {
      setPhotoUrl("https://images.unsplash.com/photo-1554415707-9e49016a44a6?auto=format&fit=crop&w=800&q=80");
      setNotes("Hardware supplies receipt");
    } else {
      setPhotoUrl("https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80");
      setNotes("Site verification snapshot");
    }
  };

  return (
    <div className="space-y-4">
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
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{showUploadForm ? "Close Form" : "+ Add Photo"}</span>
          </button>
        )}
      </div>

      {/* Upload Form Drawer / Card */}
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

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Image URL / Photo Link *
            </label>
            <input
              type="url"
              required
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Notes / Description (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Area clean, tools packed..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-orange-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-xs disabled:opacity-50"
            >
              {uploading ? "Saving Photo..." : "Save Evidence Photo"}
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
            Before and after photos provide proof of completed work.
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
