import React, { useState } from "react";
import { Phone, AlertTriangle, X, ShieldAlert, CheckCircle2 } from "lucide-react";

interface EmergencyCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId?: string;
}

export const EmergencyCallModal: React.FC<EmergencyCallModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
}) => {
  const [callInitiated, setCallInitiated] = useState(false);

  if (!isOpen) return null;

  const handleCallClick = () => {
    setCallInitiated(true);
    // Optional audit log trace in local session
    try {
      console.info(`[Safety] Emergency 112 dial action initiated for assignment: ${assignmentId || "general"}`);
    } catch {
      // safe fallback
    }
  };

  const handleClose = () => {
    setCallInitiated(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl border border-rose-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-rose-100 bg-rose-50/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-rose-900 font-display">
                Emergency Assistance (112)
              </h3>
              <p className="text-[11px] font-bold text-rose-700">
                National Emergency Response System
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-rose-100 text-rose-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Call emergency services at 112?</p>
              <p className="text-amber-800 text-[11px]">
                112 connects to immediate Police, Fire, and Medical emergency dispatch in India. Use only in situations involving immediate personal danger or severe emergency.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-2">
            <p>
              <strong>Mobile Devices:</strong> Tapping "Call 112 Now" will launch your phone's native dialer with 112 pre-filled.
            </p>
            <p>
              <strong>Desktop Devices:</strong> Clicking will prompt your default telephony software, or you can dial 112 directly from any mobile phone or landline.
            </p>
          </div>

          {callInitiated && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">Emergency action recorded</p>
                <p className="text-[11px] text-emerald-700">
                  Device dialer triggered. If dialer did not open automatically, please dial 112 directly from your phone.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              Cancel
            </button>
            <a
              href="tel:112"
              onClick={handleCallClick}
              className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition flex items-center justify-center space-x-1.5 shadow-md shadow-rose-600/30 text-center"
            >
              <Phone className="w-4 h-4" />
              <span>Call 112 Now</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
