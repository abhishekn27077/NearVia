# NEARVIA — 10-TO-15 MINUTE LIVE DEMONSTRATION SCRIPT

> **Audience**: University Viva Examiners, Technical Evaluators, Hackathon / Pitch Judges  
> **Estimated Duration**: 12 Minutes  
> **Prerequisites**: Web Client running at `http://localhost:5173` and REST API running at `http://localhost:4000`.

---

## Demo Credentials & Persona Profiles

*(Use standard seeded demonstration accounts. No plain text secrets required.)*

| Persona | Demonstration Role | Demo Phone Number | Default Test OTP | Primary Demonstration Focus |
| :--- | :--- | :--- | :---: | :--- |
| **Priya Sharma** | `PROVIDER` (Sweet Shop Owner) | `+919876543210` | `123456` | Job Posting Wizard, Candidate Matching, Cash Settlement |
| **Ramesh Kumar** | `WORKER` (Packer & Loader) | `+919876543211` | `123456` | Hyperlocal Discovery, Audio Readout, GPS Check-In |
| **Anil Verma** | `AGENT` (Community Facilitator)| `+919876543212` | `123456` | Assisted Worker Onboarding, Proxy Application |
| **Platform Officer**| `ADMIN` (Governance) | `+919876543213` | `123456` | Real-Time Metrics, Safety Disputes, Audit Logs |

---

## Step-by-Step Demonstration Script

### Act 1: The Employer Problem & Job Creation (Minutes 0:00 – 3:30)
1. **Open Browser 1** (Incognito or Chrome Profile 1) to `http://localhost:5173/login`.
2. **Login as Provider**:
   - Enter Phone: `+919876543210`.
   - Click **"Request OTP"** $\rightarrow$ Toast appears: *"OTP sent successfully"*.
   - Enter OTP: `123456` $\rightarrow$ Click **"Verify & Login"**.
   - Lands on **Provider Dashboard** (`/provider/dashboard`).
3. **Post a New Hyperlocal Shift**:
   - Click **"+ Post a Job"** (`/provider/work/new`).
   - *Optionally demonstrate Copilot*: Click **"Smart AI Draft"**, paste:  
     `"Kal subah sweet box packing ke liye 2 log chahiye Indiranagar me 750 rs"`.  
     Watch the form auto-populate Title, Hours (5 hrs), Suggested Wage (₹750), and Category.
   - Walk through the 5-Step Wizard:
     - **Step 1**: Category: *Retail & Shop Assistance*, Title: *Festival Sweet Box Packing*.
     - **Step 2**: Select Required Skill: *Packing*.
     - **Step 3**: Location: Pin drops in *Indiranagar 100ft Road* (`12.9784, 77.6412`).
     - **Step 4**: Schedule: Today from 17:00 to 22:00 (5 hours), Daily Wage: ₹750.
     - **Step 5**: Review Summary $\rightarrow$ Click **"Create Job (Draft)"**.
4. **Publish the Shift**:
   - On the created job page, click **"Publish Job"**.
   - Show status transition: `DRAFT` $\rightarrow$ `PUBLISHED`.

---

### Act 2: Worker Discovery & Multimodal Accessibility (Minutes 3:30 – 6:30)
1. **Open Browser 2** (Separate browser profile) to `http://localhost:5173/login`.
2. **Login as Worker**:
   - Enter Phone: `+919876543211`.
   - Enter OTP: `123456` $\rightarrow$ Lands on **Worker Dashboard** (`/worker/dashboard`).
3. **Toggle Available-Now**:
   - Click **"Go Online"** / **"Available Now"** toggle.
   - Highlight the real-time availability beacon.
4. **Discover Nearby Work**:
   - Navigate to **"Find Work"** (`/find-work` or `/worker/find-work`).
   - Move the **Radius Slider** to `5 km`.
   - Show the interactive map: Point out the green pin representing the job posted in Indiranagar.
   - Show the distance calculation: *"420 meters away"*.
5. **Demonstrate Low-Literacy Multimodal Readout**:
   - Click the **Speaker Icon (🔊)** on the job card.
   - The browser audio synthesizes speech in Hindi: *"Festival Sweet Box Packing, Indiranagar, paanch ghante, saat sau pachas rupay."*
6. **Submit Application**:
   - Click **"Apply Now"** on the job card.
   - Enter brief note: *"Available immediately, expert in sweet packing"*.
   - Click **"Confirm Application"** $\rightarrow$ Status changes to `APPLIED (PENDING)`.

---

### Act 3: Candidate Matching, Hiring & Shift Execution (Minutes 6:30 – 9:30)
1. **Switch back to Browser 1 (Provider)**:
   - Refresh `/provider/work/:id/applicants`.
   - Point out **Ramesh Kumar** in the applicant list with **Explainable Score**:
     - *"Top Match: 100% skill overlap, 420m away, 4.9 star rating, Available Now"*.
   - Click **"Accept & Assign Worker"**.
   - Show state change: Application becomes `ACCEPTED`, Assignment `ASSIGNED` created.
2. **Switch to Browser 2 (Worker)**:
   - Navigate to **"My Assignments"** (`/worker/assignments/:id`).
   - Click **"Confirm Shift"** $\rightarrow$ Status transitions to `CONFIRMED`.
   - Point out that exact work site address and contact number are now unlocked.
3. **Simulate GPS Check-In**:
   - Worker arrives at work site. Click **"GPS Check-In"**.
   - Browser samples coordinates $\rightarrow$ Geodesic distance computed: `18 meters`.
   - Check-in approved $\rightarrow$ Status becomes `CHECKED_IN` (Green badge).

---

### Act 4: Shift Completion & Dual Payment Settlement (Minutes 9:30 – 11:30)
1. **Switch to Browser 1 (Provider)**:
   - At the end of the shift, Provider clicks **"Confirm Shift Completion"**.
   - Assignment status transitions to `COMPLETED`.
   - Payment prompt appears: **"Settle Wage for Ramesh Kumar (₹750)"**.
2. **Demonstrate Cash Confirmation Workflow**:
   - Select **"Cash Payment"**.
   - Modal explains: *"Hand over ₹750 physical cash to the worker directly"*.
   - Click **"Confirm Cash Handover"**.
   - Assignment payment status transitions to `CONFIRMED`.
   - Receipt generated with neutral legal phrasing: *"Cash payment confirmed between provider and worker"*.
3. **Demonstrate Mutual 5-Star Reviews**:
   - Provider rates Ramesh: 5 Stars + *"Fast and punctual"*.
   - Worker switches to their app and rates Priya: 5 Stars + *"Polite employer, immediate cash settlement"*.

---

### Act 5: Governance, Audit Logs & Wrap-Up (Minutes 11:30 – 13:00)
1. **Open Browser 3 (Admin Console)**:
   - Login with admin credentials at `/login`.
   - Navigate to `/admin/dashboard`.
   - **Metrics Tab**: Point out real-time stats: GMV incremented by ₹750, Completed Shifts = 1.
   - **Audit Logs Tab**: Inspect the tamper-evident chronological event stream:
     - `OPPORTUNITY_PUBLISHED` $\rightarrow$ `APPLICATION_ACCEPTED` $\rightarrow$ `ASSIGNMENT_CONFIRMED` $\rightarrow$ `GPS_CHECK_IN` $\rightarrow$ `SHIFT_COMPLETED` $\rightarrow$ `CASH_PAYMENT_CONFIRMED`.
2. **Concluding Statement**:
   - *"NEARVIA demonstrates how PostGIS spatial indexing, explainable deterministic matching, and low-literacy UX create an accountable, safe, and transparent labor marketplace for the informal economy."*
