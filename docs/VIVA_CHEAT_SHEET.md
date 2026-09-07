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
- **Authentication**: Verifies *identity* (Phone OTP $\rightarrow$ JWT Bearer token).
- **Authorization**: Verifies *permissions* (RBAC middleware: `WORKER`, `PROVIDER`, `AGENT`, `ADMIN`).

### 8. How does RBAC work?
The Express middleware `requireRole(roles)` inspects `req.user.role` from the decoded JWT. If unauthorized, it terminates immediately with `HTTP 403 Forbidden`.

### 9. What is IDOR and how is it prevented?
Insecure Direct Object Reference: tampering with UUIDs to access another user's records. Prevented by always validating ownership in SQL: `WHERE id = $1 AND provider_id = $2`.

### 10. How does the Payment subsystem work?
Supports three modes: `DEMO` (local mock), `SANDBOX` (Razorpay Test Mode), and `PRODUCTION` (blocked pending legal KYC). Cash payments are peer-to-peer with neutral receipts: *"Cash payment confirmed between provider and worker"*. Online payments use Razorpay webhooks.

### 11. Why HMAC-SHA256 and `crypto.timingSafeEqual`?
Webhooks verify payload integrity using HMAC-SHA256 digests. `timingSafeEqual` compares signatures in constant time, eliminating statistical timing side-channel attacks.

### 12. How is Webhook Idempotency enforced?
Every webhook event ID is inserted into `webhook_events` with `UNIQUE(provider, event_id)`. Replayed webhooks trigger a unique constraint violation (PostgreSQL error 23505) and exit harmlessly without re-crediting.

### 13. How does the Matching Engine work?
A deterministic, explainable multi-factor formula:
$$\text{Score} = (0.35 \times \text{Skills}) + (0.25 \times \text{Distance}) + (0.15 \times \text{AvailableNow}) + (0.10 \times \text{Rating}) + (0.10 \times \text{Reliability}) + (0.05 \times \text{Experience})$$

### 14. What is the AI architecture and its boundaries?
Pipeline: User Voice/Text $\rightarrow$ Parser $\rightarrow$ Structured Output $\rightarrow$ Zod Schema Validation $\rightarrow$ Business Rules $\rightarrow$ User Confirmation Screen $\rightarrow$ Database.
**Guarantees**: AI has zero SQL write permissions, cannot bypass RBAC, cannot touch payments, and falls back to deterministic regex heuristics if external LLM APIs fail.

### 15. What are the key Security hardening measures?
Parameterized queries (0% SQLi), server-side identity derivation, granular route rate limiters (OTP: 6/15m), timing-safe HMAC, and strict client bundle secret isolation.

### 16. What are the current Project Limitations?
(1) Mock OTP used locally (TRAI DLT registration required for live SMS in India); (2) Razorpay Sandbox mode (commercial KYC & GST required for live money); (3) Deterministic heuristics in V1 before collecting 10k+ interactions for ML.

### 17. What is the Future Scope?
(1) V2 Learning-to-Rank (LightGBM); (2) Fine-tuned Indic-Whisper voice transcription; (3) Automated WhatsApp Business bot; (4) Cryptographic portable skill passports.
