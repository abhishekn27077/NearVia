# NEARVIA — VIVA DEFENSE CHEAT SHEET (ONE-PAGE RAPID REFERENCE)

> **Keep this sheet in hand during your viva examination. Memorize these exact technical soundbites.**

---

### 1. What is NEARVIA?
A security-hardened, production-structured hyperlocal marketplace connecting informal daily-wage workers with nearby micro-shifts (sweet packing, catering, retail help, skilled trades) within a 1–5 km radius.

### 2. What real-world problem does it solve?
Informal labor suffers from: (1) high travel costs, (2) lack of portable work reputation, (3) asymmetric wage suppression, (4) digital literacy exclusion, and (5) cash payment disputes.

### 3. What makes NEARVIA unique?
The combination of: **Hyperlocal PostGIS matching** + **Micro-shift focus (2–8 hrs)** + **Low-literacy multimodal UX (audio/Hinglish)** + **Community Agent assisted access** + **Explainable matching algorithm** + **Dual cash/online payment architecture**.

### 4. What is the System Architecture?
Multi-tier: React 18 SPA (Vite) $\rightarrow$ Stateless Node.js/Express REST API $\rightarrow$ Managed PostgreSQL 17 + PostGIS 3.3 spatial engine.

### 5. Why PostgreSQL instead of MongoDB?
ACID transactions prevent orphaned financial records; strict foreign keys enforce relationship consistency; and PostGIS provides true geodesic spatial queries on the curved Earth.

### 6. Why PostGIS?
Native `GEOGRAPHY(Point, 4326)` stores WGS84 geodesic coordinates and performs true metric radius filtering via `ST_DWithin` in $< 15\text{ ms}$ under 2D GIST spatial indexing.

### 7. What is the difference between Authentication and Authorization?
- **Authentication**: Verifies *identity* (Supabase Auth Email/Password & Google OAuth $\rightarrow$ JWT Bearer token).
- **Authorization**: Verifies *permissions* (Server-side RBAC middleware: `WORKER`, `PROVIDER`, `AGENT`, `ADMIN`).

### 8. How does RBAC work?
The Express middleware `requireRole(roles)` inspects `req.user.role` from the decoded JWT verified against PostgreSQL. If unauthorized, it terminates immediately with `HTTP 403 Forbidden`.

### 9. What is IDOR and how is it prevented?
Insecure Direct Object Reference: tampering with UUIDs to access another user's records. Prevented by always validating ownership in SQL: `WHERE id = $1 AND provider_id = $2`.

### 10. Does NearVia process payments?
**The MCA version records cash settlement and supports only clearly labelled demo/sandbox payment behavior. It does not claim to hold or transfer production funds.**
- **Cash**: Provider and worker exchange cash directly on-site; NearVia securely records the settlement confirmation and receipt.
- **Online**: Runs in Razorpay Sandbox test mode with HMAC-SHA256 signature verification. Production payment escrow is explicitly deferred to post-incorporation commercial banking.

### 11. Why HMAC-SHA256 and `crypto.timingSafeEqual`?
Webhooks verify payload integrity using HMAC-SHA256 digests. `timingSafeEqual` compares signatures in constant time, eliminating statistical timing side-channel attacks.

### 12. How is Webhook Idempotency enforced?
Every webhook event ID is inserted into `webhook_events` with `UNIQUE(provider, event_id)`. Replayed webhooks trigger a unique constraint violation (PostgreSQL error 23505) and exit harmlessly without re-crediting.

### 13. Do you use AI?
**Current Smart Matching uses transparent deterministic scoring based on factors such as skill, availability, distance, and reliability. The architecture can later support ML, but the current MCA version does not falsely depend on a paid AI API.**
$$\text{Score} = (0.35 \times \text{Skills}) + (0.25 \times \text{Distance}) + (0.15 \times \text{AvailableNow}) + (0.10 \times \text{Rating}) + (0.10 \times \text{Reliability}) + (0.05 \times \text{Preferred})$$

### 14. Is KYC implemented?
**Production KYC integration is not enabled in the free MCA version. The system is designed so verified status can be added later through a legitimate provider.**
Currently, users can submit document references that are held in `PENDING` state for admin review, but the platform does not claim live UIDAI/DigiLocker automated verification.

### 15. What are the key Security hardening measures?
Parameterized queries (0% SQLi), server-side identity derivation, granular route rate limiters, timing-safe HMAC, physically isolated Admin console (`apps/admin`), zero frontend secret leakage, and PostGIS k-anonymity aggregation on Workforce Radar.

### 16. What are the current Project Limitations?
(1) Free-first Supabase email authentication used (TRAI DLT registration required for commercial SMS in India); (2) Razorpay Sandbox mode for test settlements; (3) Deterministic multi-factor heuristics in V1 rather than black-box ML.

### 17. What is the Future Scope?
(1) V2 Learning-to-Rank (LightGBM); (2) Fine-tuned Indic-Whisper voice transcription; (3) Live UIDAI/DigiLocker Aadhaar XML KYC gateway; (4) Production multi-party banking escrow.

