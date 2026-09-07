# NEARVIA — FUTURE SCOPE & RESEARCH ROADMAP

> **Document Version**: 2.0.0  
> **Academic Standard**: MCA Dissertation Chapter — Directions for Future Work  
> **Rule**: Documented enhancements represent architectural extensions for subsequent versions. **They are not to be implemented during this final delivery.**

---

## 1. Machine Learning & Predictive Intelligence (V2 & V3)

### 1.1 Learning-to-Rank (LambdaMART / LightGBM)
- **Concept**: Once the platform logs $>10,000$ real impression-to-hire interaction pairs, replace the linear heuristic weights with a gradient-boosted Learning-to-Rank model (e.g. LightGBM or XGBoost Ranker).
- **Features**: Historical worker acceptance rate by trade, travel willingness curve by time of day, wage elasticity ratio, and seasonal employer hiring patterns.

### 1.2 Spatio-Temporal Demand Forecasting (V4)
- **Concept**: Implement spatial time-series forecasting (e.g. Spatial Graph Neural Networks or ST-GCN) to predict weekend and festival micro-shift surges across urban neighborhoods 48 hours in advance, proactively nudging available workers to high-demand clusters.

### 1.3 Graph-Based Collusive Fraud Detection (V5)
- **Concept**: Build a bipartite graph of employers, workers, and physical IP/GPS clusters to detect circular review rings, fake attendance check-ins, and collusive rating inflation.

---

## 2. Multimodal & Low-Literacy Interface Extensions

### 2.1 Fine-Tuned Indic Speech-to-Text (ASR)
- **Concept**: Deploy a quantized, fine-tuned Indian-accented Whisper model or integrate the Government of India's **Bhashini API** to support native speech input in Kannada, Tamil, Telugu, Hindi, and Marathi without relying on standard English speech-to-text models.

### 2.2 WhatsApp Business Bot Integration
- **Concept**: Provide a headless conversational interface via the WhatsApp Business API. Low-end feature phone workers can receive audio messages describing nearby micro-shifts and reply with numeric key presses (`1 = Accept, 2 = Decline`), completely eliminating the requirement for a modern smartphone app.

---

## 3. Trust, Credentials & Financial Inclusivity

### 3.1 Cryptographic Verifiable Skill Passports
- **Concept**: Issue W3C-compliant Verifiable Credentials (VCs) for completed micro-shifts, trade certifications, and attendance reliability records, allowing workers to present cryptographically tamper-evident work resumes to formal enterprise employers or micro-lending institutions.

### 3.2 Formal Micro-Credit & Credit-Scoring Rails
- **Concept**: Partner with Non-Banking Financial Companies (NBFCs) to use transparent platform earnings history as alternative credit underwriting data, granting informal workers access to low-interest emergency micro-credit.

---

## 4. Enterprise & Scale Infrastructure

### 4.1 Enterprise Staffing Console
- **Concept**: Multi-user permissions, consolidated monthly billing, and bulk shift scheduling for event management firms, retail chains, and logistics warehouses.

### 4.2 Multi-Region Database Geosharding
- **Concept**: Partition the PostgreSQL `work_opportunities` and `worker_profiles` tables using Citus or CockroachDB across metropolitan zones (Bangalore, Mumbai, Delhi-NCR) to ensure regional data locality and high-concurrency spatial query performance.
