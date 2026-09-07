# NEARVIA REST API Architecture Specification

> **Document Version**: 1.0.0  
> **Status**: Approved Infrastructure Specification (Phase 2)  
> **Project**: NEARVIA — _Work Within Reach_  
> **Service Name**: `nearvia-api`

---

## 1. API Conventions

- **Base URL Prefix**: `/api/v1`
- **Protocol**: HTTP/1.1 or HTTP/2 over TLS (HTTPS)
- **Data Interchange Format**: JSON (UTF-8)
- **Architecture**: Modular Monolith hosted in `services/api`
- **Authentication Strategy**: Supabase Auth JWT Bearer token authentication (to be activated in Phase 4).

---

## 2. Standard Envelope Formats

### 2.1 Success Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "timestamp": "2026-08-22T05:50:00.000Z"
  }
}
```

### 2.2 Error Response Envelope

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found: GET /api/v1/unknown",
    "details": null,
    "timestamp": "2026-08-22T05:50:00.000Z"
  }
}
```

---

## 3. Active Endpoints in Phase 2

### Health Check Endpoint

Returns runtime operational status of `nearvia-api` without exposing private infrastructure or credentials.

- **Endpoint**: `GET /api/v1/health` (also aliased at `GET /health`)
- **Authentication**: None (Public)
- **Response**: `200 OK`

```json
{
  "status": "ok",
  "service": "nearvia-api",
  "environment": "development",
  "timestamp": "2026-08-22T05:50:00.000Z"
}
```

---

## 4. Future Domain Endpoint Structure (Phased Roadmap)

Future phases will introduce domain-specific endpoints under `/api/v1/`:

- `/api/v1/auth/*`: OTP sign-in, token refresh, session validation
- `/api/v1/workers/*`: Worker profile, skill management, availability status
- `/api/v1/providers/*`: Employer profile, business KYC
- `/api/v1/jobs/*`: Task, shift, and job creation & discovery
- `/api/v1/matching/*`: Multi-factor explainable recommendation feed
- `/api/v1/applications/*`: Application submissions and review
- `/api/v1/assignments/*`: Active shift progress tracking and check-in
- `/api/v1/reviews/*`: Two-sided post-job rating submissions
- `/api/v1/disputes/*`: Dispute ticket filing and arbitration
- `/api/v1/agents/*`: Local assisted worker onboarding and matching
- `/api/v1/admin/*`: Platform oversight and verification consoles
