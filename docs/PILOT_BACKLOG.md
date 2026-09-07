# NEARVIA — PILOT OPERATIONAL & PRODUCT BACKLOG

> **Document Version**: 1.0.0  
> **Prioritization Framework**: Objective Multi-Factor Scoring ($\text{Impact} \times \text{Frequency} \times \text{Severity} / \text{Effort}$)  
> **Scope**: Controlled Pilot Operations, Marketplace Health, Trust & Safety  

---

## 1. Prioritization Framework

Items are scored objectively on a 1–5 scale across four parameters:
- **Impact (1–5)**: Breadth of positive effect on marketplace liquidity, trust, or safety.
- **Frequency (1–5)**: How often the problem occurs during daily pilot usage.
- **Severity (1–5)**: Consequence of failure ($5 = \text{Financial loss, legal breach, safety incident}$; $1 = \text{Cosmetic visual glitch}$).
- **Effort (1–5)**: Engineering & operational complexity ($5 = \text{Multi-week migration}$; $1 = \text{Simple query or UI tweak}$).

$$\text{Priority Score} = \frac{\text{Impact} \times \text{Frequency} \times \text{Severity}}{\text{Effort}}$$

### Priority Classification Tiers
- **P0 (Critical Blocker)**: Must be resolved immediately; pilot cannot expand safely without this.
- **P1 (High Priority)**: Affects core marketplace funnel or operational responsiveness; target within current sprint.
- **P2 (Medium Priority)**: Operational efficiency, reporting improvements, or workflow polish.
- **P3 (Low Priority)**: Nice-to-have enhancements, long-term feature requests.

---

## 2. Pilot Backlog Inventory

| ID | Title | Domain | Impact | Freq | Sev | Effort | Score | Tier | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **PB-01** | **Automated Stale Cash Payment Alerting** | Payments | 5 | 4 | 5 | 2 | **50.0** | **P0** | In Progress |
| **PB-02** | **Admin Live Urgent Jobs Broadcast Tool** | Operations | 5 | 4 | 4 | 2 | **40.0** | **P0** | Planned |
| **PB-03** | **Worker Profile Duplicate Assignment Guard** | Database | 4 | 3 | 4 | 1 | **48.0** | **P0** | Implemented |
| **PB-04** | **Location Permission Graceful Fallback for Low-End Android** | Usability | 4 | 4 | 3 | 2 | **24.0** | **P1** | Planned |
| **PB-05** | **Agent Assisted Attendance PIN Verification Override** | Operations | 4 | 3 | 4 | 2 | **24.0** | **P1** | Planned |
| **PB-06** | **Offline Audio Prompt Caching for 2G Network Workers** | Voice / AI | 4 | 3 | 3 | 3 | **12.0** | **P1** | Backlog |
| **PB-07** | **Dispute Resolution Evidence Upload Compression** | Safety | 3 | 2 | 4 | 2 | **12.0** | **P2** | Planned |
| **PB-08** | **Hyperlocal Heatmap Density Export for Operations** | Analytics | 3 | 3 | 2 | 2 | **9.0** | **P2** | Backlog |
| **PB-09** | **Weekly Automated Settlement Report via Email to Admin** | Reporting | 3 | 2 | 3 | 2 | **9.0** | **P2** | Planned |
| **PB-10** | **Provider Tax Invoice Generation (GST/PAN optional)** | Invoicing | 3 | 2 | 2 | 3 | **4.0** | **P3** | Future Scope |
| **PB-11** | **Multi-Language Push Notification Localization** | Messaging | 3 | 3 | 2 | 3 | **6.0** | **P3** | Backlog |

---

## 3. Deep Dive into Critical Tier (P0 / P1) Items

### PB-01: Automated Stale Cash Payment Alerting (P0)
- **Problem**: When a cash job completes, if either party neglects to tap "Confirm Cash", the record remains in `PENDING` state indefinitely.
- **Risk**: Worker thinks they are unpaid in system records; provider forgets to hand over physical cash.
- **Mitigation**: Automated cron job detects cash payments lingering $> 12\text{ hours}$ without dual confirmation and triggers an SMS reminder to both parties.

### PB-02: Admin Live Urgent Jobs Broadcast Tool (P0)
- **Problem**: When an immediate or urgent task is published with $< 2\text{ hours}$ start time and has no applications after 20 minutes, the employer faces a high drop-off risk.
- **Mitigation**: Provide admin operators with a 1-click "Notify Available Workers" button in the admin unassigned jobs queue that broadcasts an SMS to verified workers within 3 km.

### PB-03: Worker Profile Duplicate Assignment Guard (P0)
- **Problem**: In concurrent scenarios, a worker could theoretically accept two overlapping shift assignments.
- **Resolution**: Implemented application service level validation and recommended a partial unique database index preventing simultaneous active assignments for the same worker.

### PB-04: Location Permission Graceful Fallback for Low-End Android (P1)
- **Problem**: Field workers on basic Android devices running web browsers occasionally disable GPS or experience browser geolocation timeouts.
- **Mitigation**: If GPS fails or is denied, present a prominent manual Landmark/Area selection picker (e.g. "Koramangala 4th Block") so the worker can still browse nearby work opportunities.

---

## 4. Prioritization Rules of Engagement

1. **Safety and Wage Security Trumps All**: Any ticket involving physical safety, harassment, or unpaid wages automatically escalates to P0.
2. **No Single-User Bias**: An escalation requires evidence of systemic impact or high severity; isolated edge cases are tracked under P3 until verified by $\ge 3$ users.
3. **Low Effort Quick Wins**: P1 items with Effort score 1 are executed immediately as operational polish.
