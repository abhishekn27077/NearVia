# NEARVIA Design System & Modern UI/UX Architecture

> **Document Version**: 1.0.0  
> **Status**: Approved Blueprint (Phase 1)  
> **Project**: NEARVIA — _Work Within Reach_  
> **Aesthetic Philosophy**: High-Impact Modern Aesthetics (inspired by 21st.dev, Magic UI, and Tailwind CSS) meets Hyperlocal Ergonomic Simplicity.

---

## 1. Brand Identity & Visual Philosophy

- **Brand Name**: `NEARVIA`
- **Official Tagline**: _"Work Within Reach"_
- **Core Visual Tone**:
  - **Hyperlocal & Rapid**: High-energy emerald/teal accents evoking immediate reachability and prompt connection.
  - **Trustworthy & Robust**: Deep obsidian/slate foundations providing high-contrast readability and enterprise-grade reliability.
  - **Tactile & Ergonomic**: Mobile-first touch interactions tailored for one-handed operation on smartphones in local field environments.
  - **Transparent & Explainable**: Visual match breakdown cards, explicit distance pills, and trust verification shields.

---

## 2. Color Palette & Token System

NEARVIA utilizes a curated dark-first foundation with accessible light-mode pairings, preventing generic raw colors in favor of balanced HSL gradients.

```
+---------------------------------------------------------------------------------------------------+
|                                     NEARVIA COLOR PALETTE                                         |
+-------------------+--------------------+--------------------+--------------------+----------------+
|  OBSIDIAN SLATE   |   HYPERLOCAL TEAL  |   EMERALD PULSE    |   ACCENT AMBER     |  ERROR / ALERT |
|   (Backgrounds)   |    (Primary Brand) |  (Available-Now)   |  (Wages & Ratings) |   (Disputes)   |
|   #090d16 / #0f172a|       #0d9488      |       #10b981      |       #f59e0b      |    #f43f5e     |
+-------------------+--------------------+--------------------+--------------------+----------------+
```

### 2.1 Color Tokens

```css
:root {
  /* Surface & Background Tokens */
  --nv-bg-root: #090d16;
  --nv-bg-surface: #0f172a;
  --nv-bg-card: rgba(15, 23, 42, 0.75);
  --nv-bg-card-hover: rgba(30, 41, 59, 0.85);
  --nv-border-subtle: rgba(51, 65, 85, 0.6);
  --nv-border-glow: rgba(13, 148, 136, 0.35);

  /* Primary Brand Tokens (Hyperlocal Teal) */
  --nv-primary-50: #f0fdfa;
  --nv-primary-500: #0d9488;
  --nv-primary-600: #0f766e;
  --nv-primary-glow: 0 0 20px rgba(13, 148, 136, 0.25);

  /* Available-Now Neon Accent (Emerald) */
  --nv-status-available: #10b981;
  --nv-status-available-glow: 0 0 12px rgba(16, 185, 129, 0.4);

  /* Commercial & Value Tokens (Amber Gold) */
  --nv-accent-wage: #f59e0b;
  --nv-accent-rating: #fbbf24;

  /* Typography Colors */
  --nv-text-primary: #f8fafc;
  --nv-text-secondary: #94a3b8;
  --nv-text-muted: #64748b;
}
```

---

## 3. Modern Glassmorphism & Elevation System

Inspired by top-tier modern components (e.g., 21st.dev and Magic UI), NEARVIA utilizes layered frosted surfaces with backdrop blurs and subtle gradient borders:

```css
/* Premium Frosted Glass Card */
.nv-glass-card {
  background: var(--nv-bg-card);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--nv-border-subtle);
  border-radius: 1rem; /* 16px */
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.nv-glass-card:hover {
  background: var(--nv-bg-card-hover);
  border-color: var(--nv-border-glow);
  box-shadow:
    0 8px 30px rgba(0, 0, 0, 0.25),
    var(--nv-primary-glow);
  transform: translateY(-2px);
}
```

---

## 4. Typography & Spatial Rhythm

- **Primary Font Family**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif`.
- **Numeric Font Feature**: `font-variant-numeric: tabular-nums` for consistent alignment of distances (e.g., `2.1 km`) and wages (e.g., `₹450`).

### Scale & Hierarchy

| Level               | Font Size                  | Line Height | Weight            | Usage                                 |
| :------------------ | :------------------------- | :---------- | :---------------- | :------------------------------------ |
| **Hero Heading**    | 2.5rem – 3.75rem (40–60px) | 1.1         | Bold / Extra-Bold | Landing hero & key product statements |
| **Section Title**   | 1.5rem (24px)              | 1.25        | Semi-Bold         | Screen headers & modal titles         |
| **Card Title**      | 1.125rem (18px)            | 1.35        | Semi-Bold         | Job titles & worker names             |
| **Body Primary**    | 0.9375rem (15px)           | 1.5         | Regular           | Descriptions & instructions           |
| **Caption / Badge** | 0.75rem (12px)             | 1.4         | Medium            | Distance pills, time-to-start, tags   |

---

## 5. Signature NEARVIA Component Blueprints

### 5.1 "Available-Now" Pulse Toggle

The signature worker control communicating live readiness:

- **Visual State ON**: Radiant emerald badge (`#10b981`), outer pulsing ring animation (`animate-ping`), active timer text (e.g., _"Available for next 3 hours"_).
- **Visual State OFF**: Subtle slate toggle (`#334155`), _"Currently Offline"_.

```
[ ● AVAILABLE NOW  (Expires in 2h 45m)   ( ( 🟢 ) ) ]
```

### 5.2 Hyperlocal 5 KM Distance Pill

Communicates proximity instantly without exposing private coordinates:

- **Pill UI**: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold`
- **Icon**: Subtle location pin + exact distance (e.g., `📍 1.8 km away (Jayanagar)`).

### 5.3 Explainable Match Breakdown Badge

Displays transparent matching factors:

- **Composite Score**: Circular radial progress ring (e.g., `94% Match`).
- **Breakdown Chips**:
  - `[ ✓ Skill: Plumbing ]`
  - `[ ✓ 1.8 km away ]`
  - `[ ✓ Available Now ]`
  - `[ ✓ 4.8★ Rating ]`

### 5.4 Standard Job Card Anatomy

```
+-------------------------------------------------------------------+
|  [MICRO-TASK]                      📍 1.8 km away • Starts 2:00 PM |
|  Unload Grocery Delivery Boxes                                    |
|  ⏱ 2 hours  •  👥 2 workers needed                                 |
|-------------------------------------------------------------------|
|  💰 ₹400 Fixed Wage               [ 94% Match  ✓ Skill  ✓ Distance ]|
|-------------------------------------------------------------------|
|  [ View Details ]                             [  QUICK APPLY  ]   |
+-------------------------------------------------------------------+
```

### 5.5 Worker Card Anatomy (Employer View)

```
+-------------------------------------------------------------------+
|  Ravi Kumar                       [ 🟢 AVAILABLE NOW ]             |
|  ⭐ 4.8 (14 completed jobs)       📍 1.4 km away                  |
|  Skills: Package Sorting, Retail Stocking, Helper                 |
|-------------------------------------------------------------------|
|  [ ✓ Verified ID ]  [ ✓ Verified Phone ]       [ 96% Match ]       |
|-------------------------------------------------------------------|
|  [ View Profile ]                             [  ASSIGN WORKER ]  |
+-------------------------------------------------------------------+
```

---

## 6. Mobile-First Thumb-Zone & Ergonomics

For rapid on-the-go interactions on mobile screens:

```
+-------------------------------------------------------------+
| [ Top Zone: Status Bar, 5 km Radius Badge, Notification Bell] |
|                                                             |
|                       NEUTRAL ZONE                          |
|              Scrollable Job Feed & Map View                 |
|                                                             |
|                                                             |
|                      NATURAL THUMB ZONE                     |
|  +-------------------------------------------------------+  |
|  | [ Quick Apply ] / [ Post Task ] / [ Available Toggle] |  |
|  +-------------------------------------------------------+  |
|  [ Bottom Bar: Home | Find Work | Active Shift | Profile ]  |
+-------------------------------------------------------------+
```

1. **Touch Target Sizing**: Minimum interactive dimension of **48px $\times$ 48px** with at least 8px spacing between touch elements.
2. **Sticky Bottom Action Bars**: High-frequency actions (_"Quick Apply"_, _"Confirm Arrival"_, _"Post Task"_) remain pinned to the bottom viewport on mobile devices.
3. **One-Tap Availability**: Workers can toggle "Available-Now" directly from the dashboard header with zero menu traversal.

---

## 7. Accessibility (WCAG 2.2 AA Compliance)

- **Color Independence**: Status states (Available, Assigned, Completed, Error) are NEVER represented by color alone; every indicator pairs a color with a descriptive icon and text label.
- **Focus Indicators**: 2px solid cyan/teal outline with 2px offset on all keyboard focus states (`focus-visible:ring-2 focus-visible:ring-teal-400`).
- **Screen Reader Support**: Semantic HTML tags (`<main>`, `<nav>`, `<article>`, `<button>`, `<header>`) and explicit `aria-label` attributes on all icon buttons.
- **Readable Contrast**: Contrast ratio $> 4.5:1$ between text and background surfaces throughout all screens.

---

## 8. Micro-Interactions & Motion Choreography

- **Duration Tokens**:
  - Micro-feedback (button click, chip toggle): `150ms ease-out`
  - Card hover & elevation lift: `200ms cubic-bezier(0.16, 1, 0.3, 1)`
  - Modal enter / drawer slide: `300ms cubic-bezier(0.16, 1, 0.3, 1)`
- **Respect `prefers-reduced-motion`**: Animations gracefully degrade to instant opacity fades when reduced motion is preferred by the user's OS.

---

## 9. Phase 19 Standardized Feedback & Accessibility Components

- **`ErrorBoundary`**: Prevents white-screen client crashes; renders an accessible dialog with error summary and single-tap page reload recovery.
- **`EmptyState`**: Structured empty state with semantic icon, title, human-friendly explanation, and primary recovery action (e.g. `No suitable work within 5 km` $\rightarrow$ `[Change Filters]`).
- **`LoadingSpinner`**: ARIA-accessible loading live region (`role="status"`, `aria-live="polite"`).
- **`StatusBadge`**: Unified high-contrast badges for all system states (`PUBLISHED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `PENDING`, `ACCEPTED`, `REJECTED`, `PAID`, `REFUNDED`) featuring paired Lucide icons for color-independent state communication.

---

## 10. Product-Grade UI/UX Design System Specification

### 10.1 Typography
- **Display & Headings**: `Plus Jakarta Sans` (`font-display`, `font-extrabold` to `font-black`, tight letter-spacing).
- **Body & Controls**: `Inter` (`font-body`, high legibility, balanced weights).

### 10.2 Mobile Navigation (`NearviaBottomNav`)
- Fixed bottom navigation on mobile (`md:hidden`) with 48px touch targets, glowing active tabs, and center action button for posting shifts/tasks.
- Role-aware tabs for Workers (Home, Find Work, Shifts, Earnings, Profile), Providers/Employers (Home, My Work, Post Work, Shifts, Profile), and Agents (Home, Workers, Find Jobs, Profile).

### 10.3 Work Card 6-Question Architecture
Every job card answers the 6 core worker questions in under 3 seconds:
1. **WHAT**: Clean title & trade category pill.
2. **PAY**: Prominent ₹ amount + hourly/fixed label.
3. **DURATION**: Explicit hours (1–2h micro-task, 3–6h shift, 1-day job).
4. **WHEN**: Date, Start/End times, and "Starting Soon" badge.
5. **DISTANCE**: Proximity formatted with walking/transit indicators.
6. **TRUST**: Verified employer badge, rating indicator, and plain-language match reasons.

### 10.4 1-Tap Quick Templates Wizard
Provider work posting wizard features instant templates for top Bangalore categories (Restaurant Helper, Warehouse Loading, Construction Site Helper, Event Staff, House Cleaning, Retail Helper) pre-populating wages, timings, responsibilities, and worker requirements in 1 tap.
