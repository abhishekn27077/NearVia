import React, { useState } from "react";
import { Volume2, VolumeX, Sparkles } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export interface ReadAloudJobData {
  title: string;
  category?: string;
  description?: string;
  paymentAmount?: number | string;
  durationHours?: number;
  distanceKm?: number;
  location?: string;
  address?: string;
  startTime?: string;
  endTime?: string;
  requirements?: string;
}

export interface ReadAloudButtonProps {
  text?: string;
  job?: ReadAloudJobData;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "pill" | "icon" | "full";
  className?: string;
}

export const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({
  text,
  job,
  label,
  size = "md",
  variant = "pill",
  className = "",
}) => {
  const { language, speak, stopSpeaking, isSpeaking, isSpeechSupported, formatCurrency, formatDistance, t } =
    useLanguage();
  const [isPlayingCurrent, setIsPlayingCurrent] = useState<boolean>(false);

  if (!isSpeechSupported) {
    return null; // Gracefully degrade if browser does not support SpeechSynthesis
  }

  // Construct readable narration in the active language
  const getNarrationText = (): string => {
    if (text) return text;
    if (!job) return "";

    const pay = formatCurrency(job.paymentAmount || 0);
    const dist = job.distanceKm !== undefined ? formatDistance(job.distanceKm) : "";
    const hours = job.durationHours || 4;

    if (language === "kn") {
      let str = `${job.title}. ${t.wage} ${pay}. ${t.duration} ${hours} ಗಂಟೆಗಳು. `;
      if (dist) str += `ಸ್ಥಳ ${dist} ${t.distanceAway}. `;
      if (job.description) str += `ವಿವರ: ${job.description}. `;
      if (job.requirements) str += `ಅಗತ್ಯತೆಗಳು: ${job.requirements}.`;
      return str;
    }

    if (language === "hi") {
      let str = `${job.title}. ${t.wage} ${pay}. ${t.duration} ${hours} घंटे. `;
      if (dist) str += `दूरी ${dist} ${t.distanceAway}. `;
      if (job.description) str += `विवरण: ${job.description}. `;
      if (job.requirements) str += `ज़रूरतें: ${job.requirements}.`;
      return str;
    }

    // Default English
    let str = `${job.title}. ${t.wage} is ${pay}. ${t.duration} is ${hours} hours. `;
    if (dist) str += `Located ${dist} ${t.distanceAway}. `;
    if (job.description) str += `Details: ${job.description}. `;
    if (job.requirements) str += `Requirements: ${job.requirements}.`;
    return str;
  };

  const handleToggleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isSpeaking && isPlayingCurrent) {
      stopSpeaking();
      setIsPlayingCurrent(false);
    } else {
      const narration = getNarrationText();
      setIsPlayingCurrent(true);
      speak(narration, () => setIsPlayingCurrent(false));
    }
  };

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs min-h-[36px]",
    md: "px-3.5 py-2 text-xs sm:text-sm min-h-[44px]",
    lg: "px-5 py-2.5 text-sm sm:text-base min-h-[48px]",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleToggleSpeak}
        aria-label={isPlayingCurrent ? t.stopListening : t.listenToJob}
        title={isPlayingCurrent ? t.stopListening : t.listenToJob}
        className={`touch-target p-2 rounded-2xl flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
          isPlayingCurrent
            ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse shadow-xs"
            : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 shadow-xs"
        } ${className}`}
      >
        {isPlayingCurrent ? (
          <VolumeX className={iconSizes[size]} />
        ) : (
          <Volume2 className={iconSizes[size]} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggleSpeak}
      aria-label={isPlayingCurrent ? t.stopListening : t.listenToJob}
      className={`touch-target inline-flex items-center space-x-2 rounded-2xl font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-95 ${sizeStyles[size]} ${
        isPlayingCurrent
          ? "bg-rose-50 text-rose-700 border border-rose-300 shadow-xs"
          : "bg-blue-50/90 text-blue-700 hover:bg-blue-100 border border-blue-200 shadow-xs"
      } ${className}`}
    >
      {isPlayingCurrent ? (
        <>
          <VolumeX className={`${iconSizes[size]} text-rose-600 shrink-0`} />
          <span className="font-extrabold">{t.stopListening}</span>
          <span className="flex space-x-0.5 ml-1">
            <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce"></span>
            <span className="w-1 h-4 bg-rose-600 rounded-full animate-bounce [animation-delay:0.1s]"></span>
            <span className="w-1 h-2 bg-rose-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
          </span>
        </>
      ) : (
        <>
          <Volume2 className={`${iconSizes[size]} text-blue-600 shrink-0`} />
          <span>{label || t.listenToJob}</span>
          <Sparkles className="w-3 h-3 text-blue-500 ml-0.5 opacity-70" />
        </>
      )}
    </button>
  );
};
