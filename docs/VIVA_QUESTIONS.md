# NEARVIA — MCA VIVA-VOCE EXAMINATION QUESTION BANK (50+ Q&A)

> **Document Version**: 2.0.0  
> **Course**: Master of Computer Applications (MCA) Final Project Defense  
> **Purpose**: Comprehensive preparation for External Examiners, Technical Reviewers, and System Evaluators.  
> **Rule**: Answers are concise, technically sound, and anchored directly to the NEARVIA implementation.

---

## Category 1: Project Basics & Core Rationale

### Q1: What is NEARVIA and what specific problem does it solve?
**Answer**: NEARVIA is a full-stack, security-hardened hyperlocal marketplace designed for informal daily micro-shifts (e.g. sweet box packing, catering help, retail assistance). It solves the structural friction of physical labor markets: excessive travel costs, lack of portable work history, asymmetric wage information, digital literacy barriers, and informal cash payment disputes.

### Q2: Why did you build NEARVIA instead of using an existing platform like Urban Company or LinkedIn?
**Answer**: Corporate portals like LinkedIn cater to white-collar resume-based hiring, which excludes informal daily laborers. Managed gig apps like Urban Company act as centralized dispatchers with high take-rates (20–30%) and rigid pricing. NEARVIA is an open, low-overhead matching marketplace providing price autonomy, hyperlocal 5km discovery, and assisted access for low-literacy workers.

### Q3: What is the core architectural formula of NEARVIA?
**Answer**: *PostGIS + deterministic business rules → explainable matching → recommendations → feedback → future ML*. It establishes a reliable, explainable foundation first rather than relying on black-box AI APIs in cold-start environments.

---

## Category 2: Database, Spatial Indexing & PostGIS

### Q4: Why did you choose PostgreSQL over MongoDB or other NoSQL databases?
**Answer**: Three decisive reasons:
1. **Relational Integrity**: Marketplaces involve strict multi-entity relations (Users, Jobs, Applications, Assignments, Payments) requiring ACID transactions and foreign key constraints to prevent orphaned financial records.
2. **PostGIS**: PostgreSQL has the industry-standard spatial engine (PostGIS) for geodesic calculations on the ellipsoidal Earth.
3. **Data Consistency**: Financial ledgers and state machine transitions cannot tolerate eventual consistency or duplicate writes.

### Q5: What is PostGIS and why is it essential for NEARVIA?
**Answer**: PostGIS is an open-source spatial database extender for PostgreSQL. It introduces spatial data types (such as `GEOGRAPHY(Point, 4326)`) and spatial functions (`ST_DWithin`, `ST_Distance`). It allows NEARVIA to compute true geodesic distances along the Earth's curved surface directly inside the database query in under 15ms.

### Q6: Why did you use `GEOGRAPHY` instead of `GEOMETRY` in PostGIS?
**Answer**: `GEOMETRY` models flat, Cartesian planar coordinates, which suffer from distortion over large distances and require spatial projection conversions (`ST_Transform`) to get distances in meters. `GEOGRAPHY(Point, 4326)` uses the WGS84 ellipsoidal model and calculates true geodesic distances in **meters** natively.

### Q7: What is a GIST index and why is it used on spatial columns?
**Answer**: GIST stands for Generalized Search Tree. On spatial columns, GIST builds a hierarchical R-Tree of bounding boxes. Instead of scanning every row in the table (sequential scan: $O(N)$), GIST quickly eliminates bounding boxes that do not intersect the search radius, executing queries in logarithmic time ($O(\log N)$).

### Q8: Explain the spatial query used to discover jobs within a 5 km radius.
**Answer**:
```sql
SELECT id, title, ROUND(ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 1) AS distance_meters
FROM work_opportunities
WHERE status = 'PUBLISHED'
  AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 5000)
ORDER BY distance_meters ASC;
```
`ST_MakePoint($1, $2)` constructs the point with Longitude and Latitude. `ST_SetSRID(..., 4326)` assigns the WGS84 spatial reference system, and `ST_DWithin(..., 5000)` filters rows within 5,000 meters using the GIST index.

### Q9: How is database normalization applied in NEARVIA?
**Answer**: The schema is normalized to 3rd Normal Form (3NF). Non-key attributes depend solely on the primary key. For instance, trade skills are decoupled into `skills` and `categories`, and associated with workers via the `worker_skills` join table ($N:M$), preventing update anomalies and data duplication.

### Q10: How are database transactions used in NEARVIA?
**Answer**: We wrap multi-table state mutations in atomic transactions (`BEGIN ... COMMIT ... ROLLBACK`) via a custom `withTransaction` helper. For example, when an employer confirms cash payment, updating the assignment status to `CONFIRMED` and inserting an immutable audit entry into `payment_records` must both succeed or both fail together.

---

## Category 3: Authentication, Authorization & Security

### Q11: What is the fundamental difference between Authentication and Authorization?
**Answer**: 
- **Authentication** verifies *who you are* (e.g. verifying phone ownership via 6-digit OTP and issuing a signed JWT).
- **Authorization** verifies *what you are permitted to do* (e.g. RBAC checks ensuring only a user with `role: ADMIN` can resolve disputes or access audit logs).

### Q12: What is Role-Based Access Control (RBAC) and how is it implemented?
**Answer**: RBAC restricts API route execution based on assigned roles (`WORKER`, `PROVIDER`, `AGENT`, `ADMIN`). In NEARVIA, it is implemented via an Express middleware function `requireRole(...roles)` that checks `req.user.role` after JWT validation. If the role does not match, it immediately terminates the request with `HTTP 403 Forbidden`.

### Q13: What is Insecure Direct Object Reference (IDOR) and how did you prevent it?
**Answer**: IDOR occurs when an application exposes a reference to an internal database object (like a UUID) without verifying that the requesting user owns that object. In NEARVIA, IDOR is prevented on the backend by always enforcing ownership in the SQL query:
`WHERE id = $1 AND provider_id = $2`. Even if an attacker guesses another assignment's UUID, the database update returns 0 affected rows.

### Q14: Why do you derive user identity server-side rather than accepting `user_id` from client request bodies?
**Answer**: Client-supplied `user_id` or `role` parameters can be trivially manipulated by attackers using tools like Postman or Burp Suite. In NEARVIA, identity is strictly derived on the server by decoding and verifying the cryptographic signature of the HTTP Bearer JWT token in the `Authorization` header.

### Q15: How does NEARVIA prevent SQL Injection attacks?
**Answer**: By strictly using parameterized queries (`$1, $2, ...`) via the Node.js `pg-pool` driver across 100% of database queries. User input is treated purely as string literals by the PostgreSQL query planner and never concatenated into SQL execution strings.

### Q16: How does NEARVIA protect worker location privacy?
**Answer**: Exact worker coordinates are never broadcast publicly. In search and discovery results, coordinates are rounded or displayed as approximate neighborhood names (e.g. "Indiranagar 100ft Rd"). Exact address and direct phone contact are only unlocked to an assigned worker after the shift is officially confirmed.

### Q17: Why does NEARVIA NOT use background continuous GPS tracking?
**Answer**: Continuous background GPS drains worker phone batteries, consumes expensive cellular data, and poses serious surveillance and privacy risks. NEARVIA uses **point-in-time geofenced check-in**: location is sampled only when the worker explicitly taps "GPS Check-In" on arrival at the work site.

---

## Category 4: Payment Architecture, Webhooks & Cryptography

### Q18: What are the three payment modes in NEARVIA?
**Answer**:
1. `DEMO`: In-memory mock transitions for local offline development.
2. `SANDBOX`: Real Razorpay test mode with HMAC signature verification and test cards/UPI.
3. `PRODUCTION`: Blocked until commercial entity incorporation, GSTIN registration, and live merchant KYC approval are complete.

### Q19: Why does NEARVIA NOT implement a custom payment escrow system?
**Answer**: Under Reserve Bank of India (RBI) Payment Aggregator and Payment Gateway (PA/PG) regulations, holding third-party customer funds in a proprietary account requires a specialized banking license, minimum net worth of ₹15 crore, and strict compliance audits. Custom escrow without an RBI license is illegal.

### Q20: How does the Cash Payment Confirmation workflow work?
**Answer**: Physical cash is handed over directly from employer to worker at the work site. Either party confirms the payment in the app (`POST /api/v1/payments/cash-confirm`). The system records the transaction in `payment_records` and uses neutral phrasing: *"Cash payment confirmed between provider and worker"*. NEARVIA never claims to physically touch or guarantee the cash.

### Q21: What is a Webhook and why is it needed for online payments?
**Answer**: A webhook is an asynchronous HTTP POST callback sent by an external service (e.g. Razorpay) to NEARVIA when an event occurs (e.g. `payment.captured`). Webhooks are necessary because browser checkouts can be interrupted by network drops, tab closures, or power failures before the client can notify the backend.

### Q22: How does NEARVIA verify webhook signatures securely?
**Answer**: When Razorpay sends a webhook, it includes an `X-Razorpay-Signature` header. NEARVIA takes the **raw, unparsed request byte buffer** (`req.rawBody`), computes the HMAC-SHA256 digest using `RAZORPAY_WEBHOOK_SECRET`, and compares the computed digest with the received signature using `crypto.timingSafeEqual` to prevent timing attacks.

### Q23: What is a Timing Attack and why is `crypto.timingSafeEqual` necessary?
**Answer**: Standard string comparisons (`===`) terminate early as soon as the first mismatched character is detected. An attacker can measure sub-millisecond response latency variations to guess signatures character by character. `crypto.timingSafeEqual` executes in constant time regardless of where mismatches occur, completely eliminating the timing side-channel.

### Q24: What is Idempotency and how is it enforced on webhooks?
**Answer**: Idempotency ensures that performing an operation multiple times produces the exact same result as performing it once. In NEARVIA, every received webhook event is inserted into a `webhook_events` table with a `UNIQUE(provider, event_id)` constraint. If Razorpay retries a webhook, the unique constraint violation is caught, and the system immediately returns `HTTP 200 OK` without double-crediting or re-triggering assignment transitions.

---

## Category 5: Matching Engine & Intelligence Architecture

### Q25: Explain the multi-factor candidate matching algorithm.
**Answer**: Candidate matching uses a deterministic weighted linear model:
$$\text{CompositeScore} = (0.35 \times S_{\text{skill}}) + (0.25 \times S_{\text{dist}}) + (0.15 \times S_{\text{avail}}) + (0.10 \times S_{\text{rating}}) + (0.10 \times S_{\text{rel}}) + (0.05 \times S_{\text{exp}})$$
Every factor is normalized between $[0, 1]$.

### Q26: Why is deterministic matching used instead of deep learning in V1?
**Answer**: 
1. **Cold-Start**: ML models require thousands of historical hiring conversion pairs to train, which do not exist in a new platform.
2. **Explainability**: Blue-collar workers and small business owners need to know *why* a worker was recommended.
3. **Speed & Stability**: Heuristic queries execute in $< 15\text{ ms}$ with zero risk of hallucinations or API downtime.

### Q27: How does the AI / Natural Language Job Drafter work?
**Answer**: When an employer speaks or types in colloquial Hinglish (e.g. *"Kal subah 9 baje 2 log chahiye packing ke liye Jayanagar me, 800 rupay"*), the system passes the text through regex pattern extractors or an optional Gemini model. It extracts structured fields: title, wage, shift hours, and category. The output is strictly validated by Zod schemas before being displayed to the employer for confirmation.

### Q28: What happens if the external AI service (e.g. Gemini) is down?
**Answer**: NEARVIA has a deterministic fail-safe fallback. If Gemini times out or fails, the local regex/keyword parser immediately parses the input. The platform never crashes or blocks job posting due to external AI downtime.

### Q29: Can the AI module directly write to or update the database?
**Answer**: **No, never.** The AI is an assistive parser. It only outputs unvalidated draft JSON. This JSON must pass Zod schema validation, server-side business rules, and explicit user confirmation before any SQL insert can occur.

---

## Category 6: Work Execution & State Machines

### Q30: What are the states of a Work Opportunity?
**Answer**: `DRAFT` $\rightarrow$ `PUBLISHED` $\rightarrow$ `MATCHING` $\rightarrow$ `PARTIALLY_FILLED` $\rightarrow$ `FILLED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED` (or `EXPIRED` / `CANCELLED`).

### Q31: What are the states of a Worker Assignment?
**Answer**: `ASSIGNED` $\rightarrow$ `CONFIRMED` $\rightarrow$ `CHECKED_IN` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED` $\rightarrow$ `PAID` $\rightarrow$ `CLOSED` (or `NO_SHOW` / `CANCELLED` / `DISPUTED`).

### Q32: Who can trigger the transition from `ASSIGNED` to `CONFIRMED`?
**Answer**: Only the assigned worker (`req.user.id === assignment.worker_user_id`). The employer cannot force-confirm on behalf of the worker.

### Q33: How does Geofence Check-In work?
**Answer**: When the worker taps "Check In", their browser transmits GPS coordinates (`lat`, `lng`). The backend fetches the opportunity coordinates from the database and calculates the geodesic distance. If the distance is $\le 1000\text{ meters}$, the assignment status is updated to `CHECKED_IN`, and a timestamped row is added to `attendance_records`. If distance exceeds 1000m, the request is rejected with `HTTP 400`.

---

## Category 7: Frontend Architecture & Accessibility

### Q34: Why did you choose React 18 with Vite instead of Next.js?
**Answer**: NEARVIA is an interactive, authenticated Single Page Application (SPA) with real-time map interactions (Leaflet), dynamic state toggles, and modal workflows. Vite provides instantaneous Hot Module Replacement (HMR) during development and generates an optimized static client bundle (`apps/web/dist`) that can be served via CDN with zero server-side Node.js rendering overhead.

### Q35: How does NEARVIA support low-literacy informal workers?
**Answer**:
1. High-contrast, color-coded visual cards with trade iconography.
2. Multimodal text-to-speech via the browser's Web SpeechSynthesis API in Hindi and English.
3. Minimalist 1-tap action buttons ("Available Now", "Apply", "Check In").
4. The Community Agent network, which allows literate local agents to register and apply for jobs on behalf of workers.

### Q36: How is sensitive data kept out of the frontend bundle?
**Answer**: All secrets (Supabase Service Role Key, Database connection strings, Razorpay Webhook Secret, Gemini API Key) are strictly confined to the backend `services/api` environment. The frontend bundle (`apps/web`) only accesses public variables prefixed with `VITE_`.

---

## Category 8: Community Agents & Inclusive Access

### Q37: What is the purpose of the Community Agent role?
**Answer**: The Community Agent persona bridges the digital divide for workers who lack smartphones, internet connectivity, or functional literacy. Verified agents act as trusted local facilitators who can enroll workers, keep their trade skills updated, and submit proxy applications with the worker's verbal or physical consent.

### Q38: How do you prevent agents from exploiting or misrepresenting workers?
**Answer**: All agent actions are linked to an `agent_worker_relationships` audit record. Workers can view their sponsoring agent and revoke proxy authority. Furthermore, payments are confirmed directly to the worker on-site, preventing wage skimming by intermediaries.

---

## Category 9: Scalability, Performance & Testing

### Q39: What were the results of your automated test suite?
**Answer**: 26 test files and 226 automated tests passed with a 100% pass rate in 8.21 seconds, covering unit tests, integration workflows, and 16 dedicated security negative tests.

### Q40: How does NEARVIA scale horizontally to handle high traffic?
**Answer**: The Express API tier is completely stateless: authentication is token-based (JWT) and session state is not stored in process memory. Multiple API containers can run behind a load balancer (NGINX/Cloudflare). Database scalability is supported by PostgreSQL connection pooling, read replicas, and PostGIS GIST indexes that keep spatial queries under 15ms.

### Q41: What rate limiters are configured on the API?
**Answer**:
- Phone OTP Request: 6 requests per 15 minutes.
- AI NLP Parsing: 30 requests per 15 minutes.
- Payment Orders: 30 requests per 15 minutes.
- In-App Messaging: 60 messages per 15 minutes.
- Payment Webhooks: 120 requests per minute.

---

## Category 10: Production Readiness & Blockers

### Q42: Is NEARVIA currently running in live production with real money?
**Answer**: **No.** NEARVIA is currently staging-validated and operating in Razorpay Sandbox mode. We maintain strict academic and professional honesty: real payment processing and telecom SMS dispatch are explicitly marked as **BLOCKED** pending commercial business incorporation, GSTIN registration, nodal account agreements, and TRAI DLT telecom compliance.

### Q43: What is TRAI DLT registration and why does it affect SMS OTPs?
**Answer**: The Telecom Regulatory Authority of India (TRAI) requires commercial entities to register their business identity, sender headers, and pre-approved SMS message templates on a Distributed Ledger Technology (DLT) platform before telecom operators will route transactional SMS messages. During staging, we use a secure local mock OTP provider.

### Q44: What are the primary KPIs monitored on the Admin Dashboard?
**Answer**:
1. Gross Marketplace Value (GMV in ₹).
2. Shift Fill Rate ($\text{Assigned Workers} / \text{Workers Needed}$).
3. Active Available-Now Workers.
4. Active Published Work Opportunities.
5. Dispute Ratio ($\text{Disputed Assignments} / \text{Total Assignments}$).

### Q45: What happens if an employer refuses to pay a worker after completion?
**Answer**: The worker initiates an in-app dispute (`POST /api/v1/safety/disputes`). The assignment enters a frozen dispute status. The platform administrator reviews the evidence (GPS check-in logs, arrival timestamps, communication records) in the Admin Console and can penalize the employer, suspend their account, or lower their platform trust score.

---

## Category 11: Rapid-Fire Technical Distinctions

### Q46: Difference between `ST_Distance` and `ST_DWithin`?
**Answer**: `ST_Distance` calculates the actual floating-point geodesic distance between two points. `ST_DWithin` is a boolean spatial filter that uses the GIST index to quickly determine if two geometries are within a specified distance, making it much faster for search filtering.

### Q47: What is Zod and why is it used?
**Answer**: Zod is a TypeScript-first schema declaration and validation library. It validates untrusted client HTTP payloads at runtime, guaranteeing that types are strictly enforced before business logic executes.

### Q48: What is CSRF and why is NEARVIA immune to traditional CSRF?
**Answer**: Cross-Site Request Forgery (CSRF) exploits ambient browser cookie credentials. NEARVIA uses `Authorization: Bearer <jwt>` headers stored in application memory rather than automatic ambient cookies. Browsers do not automatically attach bearer tokens to cross-origin requests.

### Q49: Why integer paise instead of floating-point rupees in payment calculations?
**Answer**: Floating-point numbers in computer systems cannot accurately represent decimal fractions (e.g. $0.1 + 0.2 = 0.30000000000000004$), leading to financial rounding discrepancies. Storing amounts as integer paise ($₹1.00 = 100\text{ paise}$) guarantees exact precision.

### Q50: Summarize NEARVIA in one sentence for the viva conclusion.
**Answer**: NEARVIA is a security-hardened, spatial-first marketplace that combines PostGIS geodesic indexing, explainable multi-factor matching, and low-literacy multimodal UX to empower informal daily-wage workers with dignified, transparent, and verified local employment.
