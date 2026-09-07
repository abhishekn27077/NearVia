# NEARVIA Intelligent Matching Engine & Explainable Ranking Specification

> **Document Version**: 1.0.0  
> **Status**: Approved Architecture (Phase 8)  
> **Project**: NEARVIA — _Work Within Reach_  
> **Core Principle**: Deterministic, Explainable, Fair, Fast Multi-Factor Scoring

---

## 1. Executive Overview

The NEARVIA Intelligent Matching Engine calculates real-time compatibility between local workers and published short-duration work opportunities (micro-tasks, short shifts, one-day jobs) within a strict **5 km hyperlocal radius**.

In accordance with NEARVIA architectural invariants, the Phase 8 engine is **100% deterministic and explainable**. It avoids opaque black-box AI/LLM scoring, ensuring that every recommendation is testable, instantaneous, and accompanied by transparent, human-understandable reasons.

```
+-----------------------------------------------------------------------------------+
|                        NEARVIA MATCHING & RANKING PIPELINE                         |
|                                                                                   |
|  [ Worker Profile ]                  [ Work Opportunity ]                         |
|  - Skills & Experience               - Required Trade Skills                      |
|  - Available-Now / Slots             - Date, Time Window, Duration                |
|  - PostGIS Location (5 km)           - PostGIS Location (5 km)                    |
|  - Category Experience               - Work Type & Urgency                        |
|                                                                                   |
|                                         |                                         |
|                                         v                                         |
|             +-------------------------------------------------------+             |
|             |  STAGE 1: HARD FILTERING (PostgreSQL / PostGIS)       |             |
|             |  - ST_DWithin(location, radiusKm)                     |             |
|             |  - status = 'PUBLISHED' AND work_date >= CURRENT_DATE |             |
|             |  - Mandatory Skill Presence                           |             |
|             +-------------------------------------------------------+             |
|                                         |                                         |
|                                         v                                         |
|             +-------------------------------------------------------+             |
|             |  STAGE 2: MULTI-FACTOR WEIGHTED SCORING (0-100)       |             |
|             |  1. Skill Compatibility (35%)                         |             |
|             |  2. Availability & Time Fit (25%)                     |             |
|             |  3. Distance Proximity (20%)                          |             |
|             |  4. Duration Preference (10%)                         |             |
|             |  5. Category Experience (5%)                          |             |
|             |  6. Urgency Alignment (5%)                            |             |
|             +-------------------------------------------------------+             |
|                                         |                                         |
|                                         v                                         |
|             +-------------------------------------------------------+             |
|             |  STAGE 3: EXPLANATION GENERATION                      |             |
|             |  - Positive factors: "✓ 2 of 2 skills matched"        |             |
|             |  - Limitations: "ℹ 3.8 km away (near 5 km radius)"    |             |
|             +-------------------------------------------------------+             |
|                                         |                                         |
|                                         v                                         |
|  [ Ranked Matched Opportunities with Compatibility Score & Reasons ]              |
+-----------------------------------------------------------------------------------+
```

---

## 2. Hard Requirements vs. Soft Ranking Factors

NEARVIA strictly separates binary feasibility from multi-dimensional ranking:

### 2.1 Hard Requirements (Exclusion Criteria)

Candidates failing any hard filter are completely excluded from matching recommendations:

1. **Spatial Boundary**: Must be within the configured search radius ($\le 5\text{ km}$ by default, maximum $15\text{ km}$).
2. **Lifecycle Status**: Must be `PUBLISHED` and unexpired (`work_date >= CURRENT_DATE`).
3. **Mandatory Skills**: When a work opportunity flags a skill as `isRequired = true`, candidates lacking that skill receive a skill score of `0` and `isEligible = false`.
4. **Active Schedule Conflict**: Workers with conflicting active assignments are excluded from the candidate pool.

### 2.2 Soft Ranking Factors

Factors that influence the relative position and composite compatibility score (0–100) among eligible opportunities.

---

## 3. Mathematical Scoring Model & Factor Weights

The composite match score is calculated as a weighted sum of normalized component scores ($S_i \in [0, 100]$):

$$\text{Match Score} = \sum_{i=1}^{6} (w_i \times S_i)$$

Where $\sum w_i = 1.00$ (100%).

| Factor                      | Weight ($w_i$) | Component          | Scoring Methodology                                                                                                                             |
| :-------------------------- | :------------: | :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill Compatibility**     |    **35%**     | $S_{\text{skill}}$ | $80\% \times \frac{\text{Matched Required Skills}}{\text{Total Required Skills}} + 20\% \text{ Experience Bonus} + 10\% \text{ Optional Bonus}$ |
| **Availability & Time Fit** |    **25%**     | $S_{\text{avail}}$ | $100\%$ (slot fully covers hours or live Available-Now), $65\%$ (partial overlap), $75\%$ (scheduled future)                                    |
| **Distance Proximity**      |    **20%**     | $S_{\text{dist}}$  | Linear spatial decay: $100 \times \left(1 - \frac{\text{Distance Km}}{\text{Radius Km}}\right)$                                                 |
| **Duration Preference**     |    **10%**     | $S_{\text{dur}}$   | $100\%$ ($\Delta \le 0.5\text{h}$), $80\%$ ($\Delta \le 2\text{h}$), $50\%$ ($\Delta > 2\text{h}$)                                              |
| **Category Preference**     |     **5%**     | $S_{\text{cat}}$   | $100\%$ (worker has skills in category), $70\%$ (neutral / no penalty)                                                                          |
| **Urgency Alignment**       |     **5%**     | $S_{\text{urg}}$   | $100\%$ (`IMMEDIATE` + `isAvailableNow`), $95\%$ (`URGENT` + `isAvailableNow`), $80\%$ (`NORMAL`)                                               |

### Centralized Configuration

Weights are centrally declared in `packages/config/src/constants.ts`:

```typescript
export const NEARVIA_CONFIG = {
  MATCHING_WEIGHTS: {
    SKILL_COMPATIBILITY: 0.35,
    AVAILABILITY_FIT: 0.25,
    DISTANCE_PROXIMITY: 0.2,
    DURATION_PREFERENCE: 0.1,
    CATEGORY_PREFERENCE: 0.05,
    URGENCY_RELEVANCE: 0.05,
  },
} as const;
```

---

## 4. Factor Deep Dives

### 4.1 Skill Compatibility ($S_{\text{skill}}$ — 35%)

- Evaluates trade skill alignment and documented years of experience.
- If an opportunity requires no specialized skills (e.g., simple moving assistance), $S_{\text{skill}} = 100$.
- If mandatory skills are missing, $S_{\text{skill}} = 0$.

### 4.2 Availability & Time Fit ($S_{\text{avail}}$ — 25%)

- Evaluates temporal alignment between work start/end times and worker calendar slots.
- Live `AVAILABLE_NOW` workers receive maximum priority ($100\%$) for same-day opportunities.

### 4.3 Distance Proximity ($S_{\text{dist}}$ — 20%)

- Computes geodesic distance directly using PostGIS `ST_Distance` on `GEOGRAPHY(Point, 4326)`.
- Closer opportunities within the 5 km radius score progressively higher (e.g., $1.0\text{ km} \rightarrow 80\text{ pts}$, $4.5\text{ km} \rightarrow 10\text{ pts}$).

---

## 5. Explainable Reasoning Model

Every recommendation returns structured, human-friendly reasons:

```json
{
  "score": 92,
  "reasons": [
    "All 2 required trade skills matched (Commercial Cooking, Food Safety)",
    "Available now for immediate neighborhood start",
    "Extremely close: 1.2 km away (walkable distance)",
    "Matches your experience in Restaurant & Hospitality",
    "Urgent posting matches your immediate readiness"
  ],
  "limitations": ["1.8 km away (within 5 km radius)"],
  "breakdown": {
    "skillScore": 100,
    "availabilityScore": 100,
    "distanceScore": 76,
    "durationScore": 90,
    "categoryScore": 100,
    "urgencyScore": 95
  },
  "isEligible": true
}
```

---

## 6. Fairness, Anti-Bias & Privacy Invariants

1. **Zero Protected Personal Attributes**: Matching algorithms NEVER ingest, store, or evaluate religion, caste, race, gender, sexual orientation, political beliefs, or socio-economic background.
2. **No Pay-to-Win Override**: High compensation or premium provider tiers are strictly secondary and CANNOT override missing skills or schedule incompatibility.
3. **Location Privacy**: Precise worker coordinates are never exposed to job posters or public feeds. Discovered cards display only approximate locality names and distance radius pills.

---

## 7. Machine Learning Roadmap

The deterministic rules engine establishes the ground truth training dataset for future ML models:

1. **Phase 8 (Current)**: Deterministic, explainable multi-factor scoring.
2. **Phase 10+ (Future)**: Feature collection (application acceptance rates, completion quality, on-time arrivals).
3. **Phase 14+ (Future)**: Optional gradient-boosted re-ranking (e.g., XGBoost / LightGBM) trained on historical successful match outcomes while retaining deterministic explainability fallbacks.
