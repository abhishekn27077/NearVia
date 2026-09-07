# NEARVIA — COMPREHENSIVE USER FLOWS & INTERACTION RUNBOOK

> **Document Version**: 2.0.0  
> **Audience**: Product Designers, MCA Evaluators, End-to-End QA Engineers  
> **Personas Covered**: Worker (Informal Laborer), Provider (Business / Micro-Employer), Community Agent (Assisted Access Facilitator), Administrator (Platform Governance)

---

## 1. Persona 1: Worker Journey (Micro-Shift Execution)

```
[1. AUTH]         Phone Entry -> 6-Digit OTP -> Auto-Login as WORKER
    ↓
[2. DASHBOARD]    View Active Shifts, Earnings Summary, Quick Action Buttons
    ↓
[3. PROFILE]      Set Trade Skills (e.g. Packing, Catering), Experience Years
    ↓
[4. GO ONLINE]    Toggle "Available Now" (1-hour/4-hour active beacon)
    ↓
[5. DISCOVER]     "Find Work" -> Radius Slider (1-10 km) -> Map / List View
    ↓
[6. RECOMMEND]    Browse AI / Rule-based Recommendations tailored to skills
    ↓
[7. APPLY]        Tap "Apply" on Job Card -> Optional Note -> Submit
    ↓
[8. ASSIGNMENT]   Provider accepts -> Push Notification -> Assignment Detail View
    ↓
[9. CONFIRM]      Worker taps "Confirm Shift" -> Unlocks exact address & phone
    ↓
[10. DIRECTIONS]  Tap "Get Directions" -> Visual routing path & transit guidance
    ↓
[11. CHECK-IN]    Arrive on-site (<1000m) -> Tap "GPS Check-In" -> Geofence passes
    ↓
[12. WORK]        Execute work shift on-site under employer supervision
    ↓
[13. COMPLETE]    Provider marks shift complete -> In-app completion alert
    ↓
[14. PAYMENT]     Cash received & confirmed OR online payout receipt issued
    ↓
[15. REVIEW]      Submit 1–5 Star Rating & Feedback for the employer
```

---

## 2. Persona 2: Provider Journey (Hiring & Shift Settlement)

```
[1. AUTH]         Phone Entry -> 6-Digit OTP -> Login as PROVIDER
    ↓
[2. DASHBOARD]    View Active Job Postings, Unread Inquiries, Pending Hires
    ↓
[3. POST JOB]     Wizard: Step 1 (Title/Category) -> Step 2 (Skills) -> 
                  Step 3 (Location Picker) -> Step 4 (Wage/Hours) -> Step 5 (Preview)
    ↓
[4. PUBLISH]      Click "Publish Job" -> Transitions from DRAFT to PUBLISHED
    ↓
[5. APPLICANTS]   Review inbound worker applications with skill matching scores
    ↓
[6. MATCHING]     Open "Recommended Candidates" -> View top nearby verified workers
    ↓
[7. ASSIGN]       Click "Accept & Assign Worker" -> Micro-contract generated
    ↓
[8. SUPERVISE]    Monitor worker GPS check-in arrival timestamp on dashboard
    ↓
[9. COMPLETE]     Tap "Confirm Shift Completion" upon satisfactory task delivery
    ↓
[10. SETTLE]      Select Payment Method:
                  • Option A: "Confirm Cash Payment" (Direct cash handover)
                  • Option B: "Pay Online via Razorpay" (UPI / Card / Netbanking)
    ↓
[11. REVIEW]      Submit mutual rating and feedback for the worker
```

---

## 3. Persona 3: Community Agent Journey (Assisted Access Facilitator)

Community Agents solve the digital divide for low-literacy or non-smartphone-owning informal workers.

```
[1. AUTH]         Agent Login with Verified Credential
    ↓
[2. ONBOARDING]   Agent meets informal worker in local neighborhood (e.g. community hub)
    ↓
[3. REGISTRATION] Agent fills worker profile on their behalf (Phone, Trade, Daily Wage)
    ↓
[4. CONSENT]      Worker gives verbal / SMS consent -> Agent logs sponsorship relationship
    ↓
[5. JOB MATCHING] Agent searches available local jobs matching worker's skill set
    ↓
[6. PROXY APPLY]  Agent submits proxy application with worker's consent
    ↓
[7. NOTIFY]       Agent receives SMS/call notification and directs worker to work site
    ↓
[8. TRACKING]     Agent tracks worker shift completion & fair wage payout in Agent Console
```

---

## 4. Persona 4: Platform Administrator Journey (Governance & Oversight)

```
[1. SECURE AUTH]  Admin Login with strict role check (role === 'ADMIN')
    ↓
[2. METRICS]      Admin Overview: Total GMV, Active Jobs, Active Workers, Fill Rate
    ↓
[3. AUDIT LOGS]   Inspect tamper-evident chronological audit trail of all platform events
    ↓
[4. DISPUTES]     Review open payment or work quality disputes:
                  • Read worker claim & provider evidence
                  • Issue binding ruling (Dismissal / Warning / Account Suspension)
    ↓
[5. SAFETY]       Review flagged reports (harassment, unsafe conditions, wage theft)
    ↓
[6. MODERATION]   Moderate inappropriate job postings or ban fraudulent accounts
```
