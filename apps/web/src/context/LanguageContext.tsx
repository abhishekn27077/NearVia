import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  Language,
  Translations,
  TRANSLATIONS,
  formatCurrency,
  formatDistance as formatDistanceUtil,
  formatDate as formatDateUtil,
  getSpeechLanguageCode,
} from "./translations";

// Re-export all types, constants, and pure formatters for convenience
export * from "./translations";

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  translate: (key: keyof Translations | string, fallback?: string) => string;
  formatCurrency: (amount: number | string) => string;
  formatDistance: (km: number | string) => string;
  formatDate: (date: string | Date) => string;
  speak: (text: string, onEnd?: () => void) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  isSpeechSupported: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "nearvia_user_language";

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "kn" || saved === "hi" || saved === "en") {
        return saved;
      }
    } catch {
      // Storage unavailable
    }
    return "en";
  });

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const isSpeechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage unavailable
    }
  };

  // Sync document language attribute for accessibility / screen readers
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  // Fallback translation helper
  const translate = (key: keyof Translations | string, fallback?: string): string => {
    const currentDict = TRANSLATIONS[language] as unknown as Record<string, string>;
    if (currentDict && currentDict[key]) {
      return currentDict[key];
    }
    const englishDict = TRANSLATIONS.en as unknown as Record<string, string>;
    if (englishDict && englishDict[key]) {
      return englishDict[key];
    }
    return fallback || String(key);
  };

  // Context-bound distance formatter
  const formatDistance = (km: number | string): string => {
    return formatDistanceUtil(km, language);
  };

  // Context-bound date formatter
  const formatDate = (date: string | Date): string => {
    return formatDateUtil(date, language);
  };

  // Browser-native Speech Synthesis (Read Aloud)
  const stopSpeaking = () => {
    if (isSpeechSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const speak = (text: string, onEnd?: () => void) => {
    if (!isSpeechSupported || !text) return;
    stopSpeaking();

    const langCode = getSpeechLanguageCode(language);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.95; // slightly slower for better low-literacy comprehension

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        translate,
        formatCurrency,
        formatDistance,
        formatDate,
        speak,
        stopSpeaking,
        isSpeaking,
        isSpeechSupported,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
