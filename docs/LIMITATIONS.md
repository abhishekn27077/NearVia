# NEARVIA — SYSTEM BOUNDARIES & TECHNICAL LIMITATIONS

> **Document Version**: 2.0.0  
> **Academic & Professional Standard**: Technical Transparency & Disclosure  
> **Mandate**: Clearly define what NEARVIA is and what it is not, disclosing all operational boundaries and external dependencies.

---

## 1. Inventory of Active System Limitations

### 1.1 SMS & Telecom Delivery (Mock OTP)
- **Current State**: Uses an in-memory, cryptographically salted Mock OTP generator during local testing and staging.
- **Limitation**: Real SMS delivery to consumer mobile numbers is not active.
- **Root Cause**: The Telecom Regulatory Authority of India (TRAI) mandates corporate Distributed Ledger Technology (DLT) registration for sender IDs (e.g. `VM-NEARVI`) and pre-approved SMS templates under commercial business identity.
- **Impact**: System operates flawlessly with mock credentials, but real telecom delivery requires corporate activation.

### 1.2 Digital Payment Processing (Razorpay Sandbox)
- **Current State**: Uses Razorpay Test Mode with full HMAC-SHA256 signature verification and simulated webhook deliveries.
- **Limitation**: Real monetary capture and bank payouts are not live.
- **Root Cause**: Live payment gateway activation is legally restricted by the Reserve Bank of India (RBI) and merchant acquirers pending Certificate of Incorporation, corporate PAN, GSTIN, and merchant categorization compliance.
- **Impact**: End-to-end payment workflows, webhook verification, and database state transitions are proven, but financial settlement is confined to sandbox tokens.

### 1.3 Matching Engine (Deterministic Heuristics vs ML)
- **Current State**: Uses a linear-weighted multi-factor scoring formula combining PostGIS geodesic distance, verified skill overlap, real-time availability, and historical attendance.
- **Limitation**: The system does not currently use deep neural networks, collaborative filtering, or learning-to-rank algorithms.
- **Root Cause**: Machine learning models require tens of thousands of historical impression-to-hire interaction pairs. In cold-start settings, ML outputs arbitrary hallucinations.
- **Impact**: Matching is 100% transparent, explainable, and fast ($<15\text{ ms}$), but does not yet learn non-linear worker behavioral preferences.

### 1.4 Work Location Check-In (Point-in-Time Geofence)
- **Current State**: Samples worker GPS coordinates at the instant the worker clicks "GPS Check-In".
- **Limitation**: Does not continuously track worker movement or GPS breadcrumbs during the shift.
- **Rationale**: Deliberate ethical and technical decision: continuous background GPS rapidly exhausts low-end phone batteries, consumes expensive cellular data, and introduces intrusive surveillance risks for informal workers.

### 1.5 External AI Copilot Availability
- **Current State**: Natural language job drafting can utilize Google Gemini 1.5 Flash when an API key is configured.
- **Limitation**: Relies on external outbound cloud connectivity.
- **Mitigation**: A local deterministic regex/keyword parser immediately handles requests if the LLM API is unavailable, ensuring the application never crashes.

### 1.6 Single-Region Database Deployment
- **Current State**: Operates on a single-primary managed PostgreSQL instance.
- **Limitation**: While connection pooling and PostGIS spatial indexing yield sub-15ms queries, multi-region geographic read replicas and active-active failover are not implemented in the current staging deployment.
