import React, { createContext, useContext, useState, ReactNode } from "react";

export type Language = "en" | "kn" | "hi";

export interface Translations {
  // Navigation & Brand
  brandTagline: string;
  findWork: string;
  myShifts: string;
  postWork: string;
  myPostings: string;
  myApplications: string;
  dashboard: string;
  logIn: string;
  getStarted: string;
  logOut: string;
  networkLive: string;

  // Discovery & Job Cards
  workWithinReach: string;
  discoverySubtitle: string;
  searchPlaceholder: string;
  voiceSearchListening: string;
  voiceSearchTooltip: string;
  listenToJob: string;
  searchWork: string;
  allTypes: string;
  task: string;
  shift: string;
  job: string;
  recommended: string;
  nearest: string;
  highestPay: string;
  fixedPayout: string;
  perHour: string;
  match: string;
  distanceAway: string;
  applyNow: string;
  viewDetails: string;
  applied: string;
  noJobsFound: string;
  expandRadius: string;

  // Worker Actions & Status
  availableNow: string;
  goOffline: string;
  shiftCompleted: string;
  inProgress: string;
  pending: string;
  hired: string;

  // Language Names
  english: string;
  kannada: string;
  hindi: string;
}

const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    brandTagline: "Work Within Reach",
    findWork: "Find Work (5 KM)",
    myShifts: "My Shifts",
    postWork: "Post Work",
    myPostings: "My Postings",
    myApplications: "My Applications",
    dashboard: "Dashboard",
    logIn: "Log In",
    getStarted: "Get Started",
    logOut: "Log Out",
    networkLive: "5 KM Live Network",

    workWithinReach: "Work Within Reach",
    discoverySubtitle: "Real-time tasks, shifts, and jobs with same-day settlement around your location.",
    searchPlaceholder: "Search by trade, skill or task (e.g. bakery helper, cleaning, repair)...",
    voiceSearchListening: "Listening... speak now",
    voiceSearchTooltip: "Tap to search by voice",
    listenToJob: "Read job details aloud",
    searchWork: "Search Work",
    allTypes: "All Types",
    task: "Task (1–3h)",
    shift: "Shift (4–8h)",
    job: "Job (1+ Days)",
    recommended: "Best Match",
    nearest: "Nearest",
    highestPay: "Highest Pay",
    fixedPayout: "Fixed Payout",
    perHour: "/ hour",
    match: "Match",
    distanceAway: "away",
    applyNow: "Quick Apply",
    viewDetails: "View Details",
    applied: "Applied",
    noJobsFound: "No opportunities found within selected radius",
    expandRadius: "Expand to 5 KM",

    availableNow: "Available Now",
    goOffline: "Turn Offline",
    shiftCompleted: "Shift Completed",
    inProgress: "In Progress",
    pending: "Pending",
    hired: "Hired 🎉",

    english: "English",
    kannada: "ಕನ್ನಡ",
    hindi: "हिंदी",
  },
  kn: {
    brandTagline: "ನಿಮ್ಮ ಸಮೀಪದ ಕೆಲಸ",
    findWork: "ಕೆಲಸ ಹುಡುಕಿ (5 ಕಿ.ಮೀ)",
    myShifts: "ನನ್ನ ಪಾಳಿಗಳು",
    postWork: "ಕೆಲಸ ಪೋಸ್ಟ್ ಮಾಡಿ",
    myPostings: "ನನ್ನ ಪೋಸ್ಟಿಂಗ್‌ಗಳು",
    myApplications: "ನನ್ನ ಅರ್ಜಿಗಳು",
    dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    logIn: "ಲಾಗಿನ್",
    getStarted: "ಪ್ರಾರಂಭಿಸಿ",
    logOut: "ಲಾಗ್‌ಔಟ್",
    networkLive: "5 ಕಿ.ಮೀ ಲೈವ್ ನೆಟ್‌ವರ್ಕ್",

    workWithinReach: "ನಿಮ್ಮ ಸಮೀಪದ ಕೆಲಸ",
    discoverySubtitle: "ನಿಮ್ಮ ಸ್ಥಳದ ಸುತ್ತಮುತ್ತಲಿನ ಅದೇ ದಿನದ ಪಾವತಿಯೊಂದಿಗೆ ತಕ್ಷಣದ ಕೆಲಸಗಳು ಮತ್ತು ಪಾಳಿಗಳು.",
    searchPlaceholder: "ಕೆಲಸ ಅಥವಾ ಕೌಶಲ್ಯದ ಮೂಲಕ ಹುಡುಕಿ (ಉದಾ: ಬೇಕರಿ ಕೆಲಸ, ಸ್ವಚ್ಛತೆ, ಲೋಡಿಂಗ್)...",
    voiceSearchListening: "ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ... ಮಾತನಾಡಿ",
    voiceSearchTooltip: "ಧ್ವನಿಯ ಮೂಲಕ ಹುಡುಕಲು ಒತ್ತಿ",
    listenToJob: "ಕೆಲಸದ ವಿವರಗಳನ್ನು ಆಲಿಸಿ",
    searchWork: "ಹುಡುಕಿ",
    allTypes: "ಎಲ್ಲಾ ವಿಧಗಳು",
    task: "ಸಣ್ಣ ಕೆಲಸ (1–3 ಗಂಟೆ)",
    shift: "ಪಾಳಿ (4–8 ಗಂಟೆ)",
    job: "ದೈನಂದಿನ ಕೆಲಸ (1+ ದಿನ)",
    recommended: "ಉತ್ತಮ ಹೊಂದಾಣಿಕೆ",
    nearest: "ಅತ್ಯಂತ ಹತ್ತಿರ",
    highestPay: "ಹೆಚ್ಚು ಸಂಬಳ",
    fixedPayout: "ನಿಶ್ಚಿತ ಪಾವತಿ",
    perHour: "/ ಗಂಟೆಗೆ",
    match: "ಹೊಂದಾಣಿಕೆ",
    distanceAway: "ದೂರದಲ್ಲಿದೆ",
    applyNow: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",
    viewDetails: "ವಿವರ ನೋಡಿ",
    applied: "ಸಲ್ಲಿಸಲಾಗಿದೆ",
    noJobsFound: "ಆಯ್ಕೆಮಾಡಿದ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ಯಾವುದೇ ಕೆಲಸ ಕಂಡುಬಂದಿಲ್ಲ",
    expandRadius: "5 ಕಿ.ಮೀ ವಿಸ್ತರಿಸಿ",

    availableNow: "ಈಗ ಲಭ್ಯವಿದೆ",
    goOffline: "ಆಫ್‌ಲೈನ್ ಮಾಡಿ",
    shiftCompleted: "ಕೆಲಸ ಪೂರ್ಣಗೊಂಡಿದೆ",
    inProgress: "ಪ್ರಗತಿಯಲ್ಲಿದೆ",
    pending: "ಬಾಕಿ ಇದೆ",
    hired: "ನೇಮಕಗೊಂಡಿದೆ 🎉",

    english: "English",
    kannada: "ಕನ್ನಡ",
    hindi: "हिंदी",
  },
  hi: {
    brandTagline: "काम आपके पास",
    findWork: "काम ढूंढें (5 KM)",
    myShifts: "मेरी शिफ्ट",
    postWork: "काम पोस्ट करें",
    myPostings: "मेरी पोस्टिंग्स",
    myApplications: "मेरे आवेदन",
    dashboard: "डैशबोर्ड",
    logIn: "लॉग इन",
    getStarted: "शुरू करें",
    logOut: "लॉग आउट",
    networkLive: "5 KM लाइव नेटवर्क",

    workWithinReach: "काम आपके पास",
    discoverySubtitle: "आपके आस-पास उसी दिन भुगतान के साथ तुरंत काम और शिफ्ट्स।",
    searchPlaceholder: "काम या हुनर से खोजें (जैसे बेकरी हेल्पर, सफाई, लोडिंग)...",
    voiceSearchListening: "सुन रहे हैं... अब बोलिए",
    voiceSearchTooltip: "आवाज़ से खोजने के लिए दबाएं",
    listenToJob: "काम का विवरण सुनें",
    searchWork: "खोजें",
    allTypes: "सभी प्रकार",
    task: "छोटा काम (1–3 घंटे)",
    shift: "शिफ्ट (4–8 घंटे)",
    job: "दैनिक काम (1+ दिन)",
    recommended: "उत्तम मैच",
    nearest: "सबसे नजदीक",
    highestPay: "ज्यादा कमाई",
    fixedPayout: "तय भुगतान",
    perHour: "/ घंटा",
    match: "मैच",
    distanceAway: "दूरी पर",
    applyNow: "आवेदन करें",
    viewDetails: "विवरण देखें",
    applied: "आवेदन किया गया",
    noJobsFound: "चुने गए दायरे में कोई काम नहीं मिला",
    expandRadius: "5 KM तक बढ़ाएं",

    availableNow: "अभी उपलब्ध",
    goOffline: "ऑफलाइन जाएं",
    shiftCompleted: "शिफ्ट पूर्ण",
    inProgress: "जारी है",
    pending: "लंबित",
    hired: "नियुक्त 🎉",

    english: "English",
    kannada: "ಕನ್ನಡ",
    hindi: "हिंदी",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "nearvia_user_language";

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "kn" || saved === "hi" || saved === "en") {
      return saved;
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
