# NEARVIA — Phase 17: Multilingual + Accessibility Architecture (V1)

## 1. Overview & Objectives

NEARVIA's core mission is providing immediate, dignified, hyperlocal work within reach ($5\text{ KM}$) for everyday local workers and neighborhood employers. In India's urban and semi-urban job markets, many essential tradespeople (cleaners, loaders, kitchen helpers, repair assistants, delivery runners) speak and read **Kannada**, **Hindi**, or have limited textual literacy, while employers or administrators may operate in **English** or another language.

Phase 17 delivers:
1. **Centralized Multilingual Engine**: Complete dictionary parity across **English (`en`)**, **Kannada (`kn`)**, and **Hindi (`hi`)** with safe English fallback.
2. **Low-Literacy Design Paradigm**:
   - Simple, human phrasing free of technical jargon.
   - Dual-status indicators combining recognizable icons with text (never color alone).
   - Generous touch targets ($\ge 44 \times 44\text{px}$, with default buttons at $48\text{px}$) to accommodate one-handed mobile operation and varied tactile dexterity.
3. **Voice-Friendly Narration ("Read Aloud")**:
   - Zero-cost, browser-native Text-to-Speech (`window.speechSynthesis` + `SpeechSynthesisUtterance`).
   - Speaks structured job details (title, wage, duration, distance, tasks, safety guidelines) in the worker's selected language (`kn-IN`, `hi-IN`, `en-IN`).
   - Graceful degradation: button automatically hides if speech synthesis is unsupported.
4. **Accessibility (WCAG 2.2 AA Compliance)**:
   - High-contrast visible focus rings (`focus-visible:ring-2 focus-visible:ring-orange-500`).
   - Explicit `aria-label`, `aria-pressed`, `aria-checked`, and `role` attributes on toggles and interactive elements.
   - Live synchronization of `<html lang="...">` attributes to ensure OS screen readers (TalkBack, VoiceOver) pronounce text in the correct phonetic script.

---

## 2. Supported Languages & Unicode Script Support

| Language | Code | Native Name | Script Range | Google Font Support | Speech Synthesis Locale |
|---|---|---|---|---|---|
| **English** | `en` | English | Basic Latin | Inter / System UI | `en-IN` |
| **Kannada** | `kn` | ಕನ್ನಡ | `\u0C80–\u0CFF` | Noto Sans Kannada | `kn-IN` |
| **Hindi** | `hi` | हिंदी | `\u0900–\u097F` | Noto Sans Devanagari | `hi-IN` |

Typography is rendered crisply with high line-height to prevent conjunct clipping in Indic scripts (`Noto Sans Kannada` and `Noto Sans Devanagari` embedded in `index.html`).

---

## 3. Architecture & Centralized Translations

### Modular Separation (`translations.ts` & `LanguageContext.tsx`)
- **`apps/web/src/context/translations.ts`**: Pure TypeScript file with zero React/JSX dependencies. Contains:
  - `TRANSLATIONS`: Typed dictionaries for `en`, `kn`, and `hi` (~100 keys per language).
  - Formatters: `formatCurrency` (₹ with `en-IN` numbering), `formatDistance` (localized meters and kilometers), `formatDate` (locale-aware date strings).
  - Speech synthesis helpers: `getSpeechLanguageCode`, `buildJobNarrationText`.
- **`apps/web/src/context/LanguageContext.tsx`**: React Provider exposing state and hooks:
  - `language`: `"en" | "kn" | "hi"`.
  - `setLanguage(lang)`: Sets active language and updates `localStorage` (`nearvia_user_language`).
  - `t`: Active language dictionary.
  - `translate(key, defaultText)`: Fallback translation helper.
  - `speak(text, onEnd)` & `stopSpeaking()`: Native browser TTS integration.

---

## 4. Free-First Voice Narration ("Read Aloud")

NEARVIA uses the Web Speech API (`window.speechSynthesis`) for zero cost and zero network latency.

```tsx
<ReadAloudButton
  job={{
    title: "Bakery Helper Shift",
    category: "Shift",
    paymentAmount: 600,
    startTime: "08:00",
    endTime: "12:00",
    address: "Indiranagar, Bengaluru",
    distanceKm: 1.5,
  }}
/>
```

When tapped:
1. Speech synthesis cancels any active utterances to prevent audio overlap.
2. The language engine builds natural sentences according to grammar rules:
   - **Kannada**: `ಬೇಕರಿ ಸಹಾಯಕರ ಕೆಲಸ. ಸಂಬಳ ಮತ್ತು ಪಾವತಿ ₹600. ಅವಧಿ 4 ಗಂಟೆಗಳು. ಸ್ಥಳ 1.5 ಕಿ.ಮೀ ದೂರದಲ್ಲಿದೆ.`
   - **Hindi**: `बेकरी हेल्पर शिफ्ट. मजदूरी और भुगतान ₹600. अवधि 4 घंटे. दूरी 1.5 कि.मी दूरी पर.`
   - **English**: `Bakery Helper Shift. Wage & Payout is ₹600. Duration is 4 hours. Located 1.5 km away.`
3. Spoken rate is calibrated at `0.95` for enhanced comprehension among users with auditory or cognitive processing needs.

---

## 5. Low-Literacy & Physical Ergonomics

1. **Touch Targets**:
   - Minimum target height and width: $\ge 44\text{px} \times 44\text{px}$ (WCAG 2.2 Criterion 2.5.8).
   - Form inputs, primary buttons, bottom navigation icons, and language toggles have comfortable padding and minimum tap areas.
2. **Dual Status Indicators**:
   - Never rely on red/amber/green color alone to convey lifecycle state.
   - Every status pill includes both an identifiable icon and bold descriptive text (e.g., `Zap` + `"YOU ARE ONLINE"`, `ShieldCheck` + `"Location Verified"`, `CheckCircle2` + `"Completed"`).
3. **Transparent Emergency Guidance**:
   - The platform transparently instructs users to dial **`112`** for real emergencies. NEARVIA does not claim to provide police or emergency response services.

---

## 6. Verification & Test Coverage

The test suite (`services/api/tests/multilingual_accessibility.test.ts`) validates:
- 100% key parity between English, Kannada, and Hindi.
- Authentic Unicode script presence in Indic dictionaries.
- Fallback mechanics to English when keys are absent.
- Indian Rupee comma formatting (`₹1,200`, `₹50,000`, `₹1,50,000`).
- Localized distance formatting with meters ($<1\text{ km}$) and kilometers ($\ge 1\text{ km}$).
- Spoken text synthesis generation in all 3 languages.
- Accessibility standards (WCAG 2.2 AA target sizes and dual indicators).
