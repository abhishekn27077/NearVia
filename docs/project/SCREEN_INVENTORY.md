# NEARVIA Master Screen Inventory & Navigation Architecture

> **Document Version**: 1.0.0  
> **Status**: Approved Blueprint (Phase 1)  
> **Project**: NEARVIA — _Work Within Reach_

---

## 1. Role-Based Navigation Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                      GLOBAL ROUTING ROOT                                          |
+-------------------+-----------------------+-----------------------+-------------------------------+
|   WORKER PORTAL   |  JOB PROVIDER PORTAL  |  LOCAL AGENT PORTAL   |       ADMIN CONSOLE           |
+-------------------+-----------------------+-----------------------+-------------------------------+
| • Home            | • Dashboard           | • Dashboard           | • System Overview             |
| • Find Work (5km) | • Post Work (Wizard)  | • Nearby Jobs         | • Users & KYC Verification    |
| • Applications    | • Find Workers        | • Assisted Workers    | • Jobs & Moderation           |
| • Active Shift    | • Active Jobs         | • Assisted Connect    | • Dispute Arbitration         |
| • Work History    | • Applications Review | • Agent Activity      | • Skills & Categories         |
| • Profile & Trust | • Profile & Ratings   | • Profile & Badge     | • Platform Analytics          |
+-------------------+-----------------------+-----------------------+-------------------------------+
```

---

## 2. Worker Role Screens

| Screen ID    | Screen Name                     | Route Path                          | Key UI Components & Purpose                                                                                                                                                                                  |
| :----------- | :------------------------------ | :---------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SCR-W-01** | Landing Page                    | `/`                                 | Hero value proposition ("Work Within Reach"), 5 km hyperlocal explainer, role switch selector (Worker vs. Provider), quick call to action.                                                                   |
| **SCR-W-02** | Phone Login / Register          | `/auth/login`                       | Phone number entry, SMS OTP input (4–6 digits), terms & privacy check, automatic role assignment.                                                                                                            |
| **SCR-W-03** | Worker Onboarding: Profile      | `/onboarding/worker/profile`        | Full name, photo upload, preferred communication language, primary identity confirmation.                                                                                                                    |
| **SCR-W-04** | Worker Onboarding: Skills       | `/onboarding/worker/skills`         | Visual skill selector chips, years of experience stepper, primary trade tags (e.g. Retail, Loading, Plumbing).                                                                                               |
| **SCR-W-05** | Worker Onboarding: Location     | `/onboarding/worker/location`       | Map location picker (Leaflet/OSM), GPS detection button, service radius slider (1–15 km, default 5 km).                                                                                                      |
| **SCR-W-06** | Worker Onboarding: Availability | `/onboarding/worker/availability`   | "Available-Now" toggle, weekly scheduled slot picker, minimum hourly/daily wage expectation.                                                                                                                 |
| **SCR-W-07** | Worker Dashboard (Home)         | `/worker/dashboard`                 | **Top**: "Available-Now" glowing pulse toggle, current location & 5 km badge. **Main**: "Recommended for You" cards, "Starting Soon" micro-tasks, "Jobs Within 5 km" feed. **Bottom**: Thumb navigation bar. |
| **SCR-W-08** | Nearby Work Map / Feed          | `/worker/find-work`                 | Dual view switch (Interactive Map with 5 km radius circle $\leftrightarrow$ List View), distance badge, time-to-start countdown, wage pill.                                                                  |
| **SCR-W-09** | Filter & Search Modal           | `/worker/find-work/filters`         | Work type pills (Task / Shift / Job), max distance slider (1–15 km), start time picker, wage sort, skill checkboxes.                                                                                         |
| **SCR-W-10** | Job Details View                | `/worker/jobs/:id`                  | Full job briefing, distance badge (e.g. 2.1 km), start/end time, hourly/fixed wage, employer verification badge & rating, Job Readiness & orientation requirements, "Quick Apply" action bar.                |
| **SCR-W-11** | Match Reason Modal              | `/worker/jobs/:id/match-breakdown`  | Transparent multi-factor match score card (Skill overlap %, Distance proximity, Availability fit, Rating reliability).                                                                                       |
| **SCR-W-12** | My Applications List            | `/worker/applications`              | Status tabs (Active, Shortlisted, Accepted, Completed, Rejected), application timestamp, proposed wage notes.                                                                                                |
| **SCR-W-13** | Active Assignment Tracker       | `/worker/assignments/:id`           | Live status step progress (Assigned $\to$ On the Way $\to$ Arrived $\to$ In Progress $\to$ Completed), reporting supervisor contact, check-in button, address navigator.                                     |
| **SCR-W-14** | Work Completion & Payout Record | `/worker/assignments/:id/completed` | Summary of completed shift hours, total wage payout record, digital receipt, proceed to rating.                                                                                                              |
| **SCR-W-15** | Post-Job Rating Modal           | `/worker/assignments/:id/rate`      | 1–5 star rating for Job Provider, feedback tags (_"Punctual Payment"_, _"Safe Workplace"_, _"Accurate Scope"_), written comment.                                                                             |
| **SCR-W-16** | Work History & Payouts          | `/worker/history`                   | Historical shift timeline, total earnings summary, average rating breakdown, past employer reviews.                                                                                                          |
| **SCR-W-17** | Worker Profile & Trust Center   | `/worker/profile`                   | Public vs. private profile preview, KYC identity upload, verification status badge, skill management.                                                                                                        |
| **SCR-W-18** | Worker Account Settings         | `/worker/settings`                  | Language selector (English, Hindi, Kannada), notification preferences (SMS, Push), privacy fuzzing options, logout.                                                                                          |

---

## 3. Job Provider Role Screens

| Screen ID    | Screen Name                       | Route Path                           | Key UI Components & Purpose                                                                                                                                 |
| :----------- | :-------------------------------- | :----------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SCR-P-01** | Provider Onboarding               | `/onboarding/provider`               | Business or individual name, business type selector (Shop, Restaurant, Contractor, Household), location point.                                              |
| **SCR-P-02** | Provider Dashboard                | `/provider/dashboard`                | Primary action: **"Post Task / Shift"** button; stats overview (Active posts, pending applications, active shifts); "Urgent Work Needing Workers" carousel. |
| **SCR-P-03** | Create Work Wizard: Step 1        | `/provider/create/type`              | Work Model selector cards: **Micro-Task** (1–2 hrs), **Short Shift** (3–6 hrs), **Temporary Job** (1+ days).                                                |
| **SCR-P-04** | Create Work Wizard: Step 2        | `/provider/create/details`           | Job title, category, description, workers needed counter, required vs. preferred skill tags.                                                                |
| **SCR-P-05** | Create Work Wizard: Step 3        | `/provider/create/schedule`          | Work date, start time, end time, duration calculation, urgency tag ("Immediate / Today / Tomorrow").                                                        |
| **SCR-P-06** | Create Work Wizard: Step 4        | `/provider/create/location-wage`     | Exact work address, wage amount, wage type (Hourly / Fixed / Daily), orientation provided toggle, supervisor instructions.                                  |
| **SCR-P-07** | Job Preview & Publish             | `/provider/create/preview`           | Summary card review, total estimated wage calculation, 5 km candidate discovery estimate, "Publish Job" button.                                             |
| **SCR-P-08** | Active Jobs & Shift Manager       | `/provider/jobs`                     | Filterable list of published jobs (Open, In Progress, Completed, Cancelled), application count badge, time-to-start indicators.                             |
| **SCR-P-09** | Job Details & Applications        | `/provider/jobs/:id`                 | Job post metrics, list of applicant worker cards sorted by Explainable Match Score, "Quick Assign" action.                                                  |
| **SCR-P-10** | Candidate Discovery Board         | `/provider/jobs/:id/discover`        | Proximity radar showing available-now workers within 5 km, match scores, verified badges, "Send Work Invitation" action.                                    |
| **SCR-P-11** | Worker Profile Preview Modal      | `/provider/workers/:id`              | Sanitized worker summary (Name, rating, completed tasks, skill tags, distance, transparent match explanation).                                              |
| **SCR-P-12** | Active Assignment Live Monitor    | `/provider/assignments/:id`          | Worker arrival status, shift timer, contact button, "Confirm Completion" button, emergency dispute trigger.                                                 |
| **SCR-P-13** | Confirm Completion & Wage Release | `/provider/assignments/:id/complete` | Final hours confirmation, total wage summary, payment status record update, "Confirm & Rate" button.                                                        |
| **SCR-P-14** | Provider Review Modal             | `/provider/assignments/:id/rate`     | 1–5 star rating for Worker, performance tags (_"Hardworking"_, _"Punctual"_, _"Skilled"_), feedback notes.                                                  |
| **SCR-P-15** | Provider Profile & Business KYC   | `/provider/profile`                  | Business details, GST/Registration verification upload, trust score, history of completed postings.                                                         |
| **SCR-P-16** | Provider Settings                 | `/provider/settings`                 | Notification alerts (SMS on new application), staff contact settings, billing history.                                                                      |

---

## 4. Local Agent Role Screens _(Assisted Access)_

| Screen ID    | Screen Name                      | Route Path           | Key UI Components & Purpose                                                                                                        |
| :----------- | :------------------------------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **SCR-A-01** | Agent Onboarding & Verification  | `/agent/onboarding`  | Operational locality assignment, local credibility verification, ID upload.                                                        |
| **SCR-A-02** | Agent Dashboard                  | `/agent/dashboard`   | Local assigned area stats, active assisted workers count, new nearby tasks feed, recent connections.                               |
| **SCR-A-03** | Local Nearby Jobs Feed           | `/agent/jobs`        | High-urgency micro-tasks in the agent's locality, worker requirement matching helper.                                              |
| **SCR-A-04** | Assisted Workers Roster          | `/agent/workers`     | List of assisted workers registered under this agent, availability status, skills, contact phone numbers.                          |
| **SCR-A-05** | Register Assisted Worker         | `/agent/workers/new` | Simplified rapid registration form for workers with low digital literacy (Voice/Form input, skill checklist).                      |
| **SCR-A-06** | Assisted Match & Connection Flow | `/agent/connect`     | Select job $\to$ select suitable assisted worker $\to$ verify worker consent $\to$ submit official application on worker's behalf. |
| **SCR-A-07** | Assisted Activity History        | `/agent/activity`    | Audit log of assisted job matches, assignment statuses, and worker ratings.                                                        |
| **SCR-A-08** | Agent Profile & Badge            | `/agent/profile`     | Agent badge status, verified ratings, performance summary.                                                                         |

---

## 5. Platform Admin Role Screens

| Screen ID     | Screen Name                   | Route Path            | Key UI Components & Purpose                                                                                         |
| :------------ | :---------------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **SCR-AD-01** | Admin Operations Dashboard    | `/admin/dashboard`    | Real-time platform KPI telemetry (Fill rate, time-to-fill, active workers online, open disputes count).             |
| **SCR-AD-02** | User & KYC Management         | `/admin/users`        | Master directory of Workers, Providers, and Agents with verification approval/rejection actions.                    |
| **SCR-AD-03** | User Details & Audit Log      | `/admin/users/:id`    | Identity documents review, account flags, suspension toggle, activity logs.                                         |
| **SCR-AD-04** | Job Moderation Queue          | `/admin/jobs`         | Real-time stream of newly created tasks/shifts for safety review, suspicious wage/keyword flagging.                 |
| **SCR-AD-05** | Job Post Inspection           | `/admin/jobs/:id`     | Full job details, provider history, edit/cancel/ban action controls.                                                |
| **SCR-AD-06** | Dispute Arbitration Console   | `/admin/disputes`     | Open dispute tickets queue, evidence review (timestamps, check-in logs, communication notes), resolution decisions. |
| **SCR-AD-07** | Dispute Resolution View       | `/admin/disputes/:id` | Detailed case view with binding arbitration actions (Release wage, Record refund, Flag account).                    |
| **SCR-AD-08** | Skills & Category Taxonomy    | `/admin/categories`   | Add/edit verified skill taxonomies, category hierarchy, wage guidance baselines.                                    |
| **SCR-AD-09** | Platform Analytics & Research | `/admin/analytics`    | Geospatial heatmaps, time-to-first-match distributions, 5 km radius fill efficiency curves.                         |
| **SCR-AD-10** | System Configuration & Logs   | `/admin/settings`     | Global default radius adjustments, emergency kill-switches, audit logs.                                             |
