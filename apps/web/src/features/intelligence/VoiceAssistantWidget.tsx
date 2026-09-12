import React, { useState } from "react";
import {
  Mic,
  Volume2,
  Sparkles,
  X,
  Briefcase,
  ShieldCheck,
  FileCheck,
  Clock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { VoiceAssistanceResponse, LowLiteracyCard } from "@nearvia/types";

interface VoiceAssistantWidgetProps {
  onNavigate?: (route: string) => void;
}

export const VoiceAssistantWidget: React.FC<VoiceAssistantWidgetProps> = ({
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<VoiceAssistanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const speakText = (text: string, lang = "hi-IN") => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleStartListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN"; // Multilingual recognition
    recognition.interimResults = false;

    setIsListening(true);
    setTranscript("Listening... (Sun raha hu)");

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
      await sendVoiceToServer(text);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setTranscript("Could not capture audio. Please try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const sendVoiceToServer = async (text: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("nearvia_auth_token") || localStorage.getItem("token");
      const res = await fetch("/api/v1/intelligence/voice/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ transcript: text }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setResponse(data.data);
        speakText(data.data.spokenResponse, data.data.languageCode);
      }
    } catch (err) {
      console.error("Voice processing error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderCardIcon = (iconName: string) => {
    switch (iconName) {
      case "Briefcase":
        return <Briefcase className="w-6 h-6 text-indigo-500" />;
      case "ShieldCheck":
        return <ShieldCheck className="w-6 h-6 text-emerald-500" />;
      case "FileCheck":
        return <FileCheck className="w-6 h-6 text-violet-500" />;
      case "Clock":
        return <Clock className="w-6 h-6 text-amber-500" />;
      default:
        return <Briefcase className="w-6 h-6 text-indigo-500" />;
    }
  };

  const handleCardClick = (card: LowLiteracyCard) => {
    speakText(card.audioText);

    if (card.actionType === "NAVIGATE" && card.actionPayload?.route) {
      if (onNavigate) {
        onNavigate(card.actionPayload.route);
        setIsOpen(false);
      } else {
        window.location.href = card.actionPayload.route;
      }
    } else if (card.actionType === "CALL" && card.actionPayload?.phone) {
      window.location.href = `tel:${card.actionPayload.phone}`;
    }
  };

  return (
    <>
      {/* Floating Microphone Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        title="Voice & Low-Literacy Assistant (Bolo aur Kaam Pao)"
        className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition flex items-center gap-2 group"
      >
        <Mic className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-xs font-bold uppercase tracking-wider">
          Voice Assistant
        </span>
      </button>

      {/* Voice Assistant Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-150 relative">
            
            {/* Close Button */}
            <button
              onClick={() => {
                window.speechSynthesis?.cancel();
                setIsOpen(false);
              }}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center pt-2">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Voice Assistant (Bolo aur Kaam Pao)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Speak in Hindi, English, Kannada or Tamil
              </p>
            </div>

            {/* Mic Button Circle */}
            <div className="my-6 flex flex-col items-center">
              <button
                onClick={handleStartListening}
                disabled={isLoading}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition ${
                  isListening
                    ? "bg-rose-500 text-white animate-pulse shadow-rose-500/30 scale-110"
                    : isLoading
                    ? "bg-slate-400 text-white animate-spin"
                    : isSpeaking
                    ? "bg-emerald-600 text-white animate-bounce shadow-emerald-600/30"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30 hover:scale-105"
                }`}
              >
                {isLoading ? (
                  <RefreshCw className="w-8 h-8 animate-spin" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">
                {isListening
                  ? "Listening... Speak now"
                  : isLoading
                  ? "Processing voice intent..."
                  : isSpeaking
                  ? "Speaking response (Bol raha hu)..."
                  : "Tap microphone to speak"}
              </span>
            </div>

            {/* Transcript / Spoken Status */}
            {transcript && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-700 dark:text-slate-300 mb-4">
                <strong>"{transcript}"</strong>
              </div>
            )}

            {/* Audio Readout Pill */}
            {response && (
              <div className="mb-4 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-start gap-2.5">
                <button
                  onClick={() => speakText(response.spokenResponse, response.languageCode)}
                  className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0"
                  title="Listen again"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <div className="text-xs text-indigo-950 dark:text-indigo-200 font-medium pt-0.5">
                  {response.spokenResponse}
                </div>
              </div>
            )}

            {/* Low-Literacy Tap Cards */}
            {response?.lowLiteracyCards && response.lowLiteracyCards.length > 0 && (
              <div className="space-y-2.5 mt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block text-center">
                  Quick Actions (Chuniye)
                </span>
                {response.lowLiteracyCards.map((card, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCardClick(card)}
                    className="w-full p-3.5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm flex items-center justify-between gap-3 text-left transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/60 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition">
                        {renderCardIcon(card.icon)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {card.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {card.subtitle}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
