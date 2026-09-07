# NEARVIA Marketplace Metrics & Funnel Measurement Specification

> **Document Type**: Quantitative Telemetry, Analytics Engine & Measurement Specification  
> **System**: NEARVIA Hyperlocal Workforce Marketplace (`D:/NearVia`)  
> **Evaluation Philosophy**: Technically honest, mathematically sound, zero division-by-zero, explicit small sample size disclosure, privacy-preserving.

---

## 1. The Hyperlocal Marketplace Conversion Funnel

The core marketplace transaction flows through a discrete 9-stage state transition pipeline:

$$\begin{aligned}
\text{Stage 1: } & \text{Job Posted (Draft } \to \text{ Published)} \\
\downarrow & \\
\text{Stage 2: } & \text{Job Discovered / Viewed (within 5 KM Geofence)} \\
\downarrow & \\
\text{Stage 3: } & \text{Application Submitted (1-Click Apply)} \\
\downarrow & \\
\text{Stage 4: } & \text{Applicant Shortlisted} \\
\downarrow & \\
\text{Stage 5: } & \text{Assignment Confirmed (Matching Agreement)} \\
\downarrow & \\
\text{Stage 6: } & \text{Worker Arrival & GPS Check-In} \\
\downarrow & \\
\text{Stage 7: } & \text{Shift Completion Confirmed} \\
\downarrow & \\
\text{Stage 8: } & \text{Payment Settlement (Cash PIN Verification or UPI)} \\
\downarrow & \\
\text{Stage 9: } & \text{Mutual Review & Reputation Rating}
\end{aligned}$$

---

## 2. Core Operational Metrics & Mathematical Formulas

To prevent misleading claims, all metric computations adhere to defensive calculation rules:
- **Rule 1**: When denominator is $0$, metric value is defined as $0.0\%$ (or `null`/`insufficient_data`).
- **Rule 2**: Sample size ($N$) must always be disclosed alongside ratios (e.g. *"Fill Rate: 75.0% ($N = 4$ jobs)"*).

### 2.1 Fill Rate (Liquidity Ratio)
Measures the proportion of published work opportunities that successfully fill their worker capacity:

$$\text{Fill Rate} = \begin{cases} 
\dfrac{\text{Total Jobs with } \text{workers\_assigned} \ge \text{workers\_needed}}{\text{Total Published Jobs}} \times 100 & \text{if Total Published Jobs} > 0 \\ 
0.0\% & \text{otherwise} 
\end{cases}$$

### 2.2 Shift Completion Rate
Measures the reliability of confirmed work agreements reaching successful completion:

$$\text{Completion Rate} = \begin{cases} 
\dfrac{\text{Assignments in COMPLETED Status}}{\text{Total Confirmed Assignments}} \times 100 & \text{if Total Confirmed Assignments} > 0 \\ 
0.0\% & \text{otherwise} 
\end{cases}$$

### 2.3 Worker No-Show Rate
Measures confirmed workers who fail to arrive or check in within the 30-minute grace period:

$$\text{No-Show Rate} = \begin{cases} 
\dfrac{\text{Assignments in CANCELLED / NO\_SHOW Status}}{\text{Total Confirmed Assignments}} \times 100 & \text{if Total Confirmed Assignments} > 0 \\ 
0.0\% & \text{otherwise} 
\end{cases}$$

### 2.4 Cancellation Rate
Measures opportunities cancelled by employers after publication:

$$\text{Cancellation Rate} = \begin{cases} 
\dfrac{\text{Jobs in CANCELLED Status}}{\text{Total Published Jobs}} \times 100 & \text{if Total Published Jobs} > 0 \\ 
0.0\% & \text{otherwise} 
\end{cases}$$

### 2.5 Time to First Application ($T_{\text{first}}$)
$$\bar{T}_{\text{first}} = \frac{1}{N} \sum_{i=1}^{N} \left( t_{\text{first\_application}, i} - t_{\text{published}, i} \right)$$
*(Measured in minutes. Minimum $N \ge 5$ required for aggregate reporting).*

### 2.6 Time to Assignment ($T_{\text{assign}}$)
$$\bar{T}_{\text{assign}} = \frac{1}{N} \sum_{i=1}^{N} \left( t_{\text{assigned}, i} - t_{\text{published}, i} \right)$$
*(Target for micro-shifts: $< 120\text{ minutes}$).*

---

## 3. Worker & Employer Metrics Segregation

### 3.1 Worker View (Personal Telemetry Only)
- **Active / Online Status**: Real-time availability switch (`AVAILABLE_NOW`).
- **Personal Application History**: Count of applications, approvals, and rejections.
- **Completed Shifts**: Total verified hours worked and verified assignments.
- **Verified Earnings**: Net cumulative payout received in cash or online sandbox.
- **Individual Reputation**: Average star rating ($1.0 - 5.0$), On-Time Arrival Rate ($0 - 100\%$).

### 3.2 Employer View (Account Telemetry Only)
- **Active Postings**: Total jobs published, applicants received, and active workers.
- **Hiring Velocity**: Average time to review and shortlist applicants.
- **Disbursement Records**: Confirmed cash payments with PIN audit log.
- **Worker Feedback Received**: Average rating given by workers for workplace conditions.

### 3.3 Admin Operational View (Aggregate Only)
- Cross-marketplace totals: active workers, online workers, available shifts, dispute queues, unconfirmed cash payments older than 24h.

---

## 4. Matching & Recommendation Outcome Metrics

Recommendations are evaluated by **marketplace outcomes**, not theoretical AI claims:

| Metric Name | Measurement Definition | Formula |
|---|---|---|
| **Recommendation Click Rate** | Workers clicking on a high-compatibility job card | $\text{Clicks} / \text{Impressions}$ |
| **Recommendation Application Rate** | Workers applying to a recommended job | $\text{Applications from Recommended} / \text{Total Applications}$ |
| **Match Assignment Rate** | Employer selecting an algorithmic top-matched candidate | $\text{Top Match Hired} / \text{Total Hires}$ |
| **Recommendation Rejection Distribution**| Structured reasons logged via `RecommendationFeedback` | Reason frequencies: *Too far, Wrong skill, Wrong time, Low pay, Not interested* |

> **IMPORTANT**: These are classified as **Marketplace Outcome Metrics**, never misrepresented as "AI Accuracy Percentages".

---

## 5. Analytics Privacy & Security Invariants

In strict compliance with privacy standards and Indian data protection principles:

1. **Strictly Prohibited from Analytics & Telemetry**:
   - Government identification numbers (Aadhaar, PAN, Voter ID).
   - Identity document images or biometric scans.
   - Exact home coordinates (latitude/longitude coordinates are snapped to a 500-meter generalized neighborhood centroid).
   - User private chat messages or phone numbers.
   - Payment credentials, bank account numbers, or UPI PINs.
2. **Pseudonymous Identifiers**:
   - All events in `platform_events` record internal UUIDs (`user_id`, `resource_id`, `event_type`) without PII payloads.
3. **No Third-Party Analytics Exfiltration**:
   - All telemetry and funnel data reside inside the self-hosted PostgreSQL database. Zero tracking pixels or client telemetry sent to external marketing platforms.
