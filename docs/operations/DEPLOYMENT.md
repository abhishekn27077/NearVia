# NEARVIA Production Deployment Guide

## 1. Environment Architecture

NEARVIA is deployed as a dual-tier modular architecture:
1. **Frontend**: Vite Single Page Application (SPA) hosted on a CDN / Vercel with TLS termination.
2. **Backend**: Express REST API runtime on Node.js 20+ with PostgreSQL/PostGIS.

---

## 2. Environment Variables

### 2.1 Backend (`services/api/.env`)
| Variable | Type | Required (Prod) | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `string` | Yes | `production` |
| `PORT` | `number` | Yes | Port for HTTP server (e.g. `4000`) |
| `DATABASE_URL` | `string` | Yes | PostgreSQL connection string with SSL |
| `SUPABASE_URL` | `string` | Yes | Supabase Project URL |
| `SUPABASE_ANON_KEY` | `string` | Yes | Public Supabase Anon key |
| `SUPABASE_SERVICE_ROLE_KEY`| `string` | Yes | Private backend service role key |
| `CORS_ORIGIN` | `string` | Yes | Restrictive frontend domain (e.g. `https://app.nearvia.in`) |

### 2.2 Frontend (`apps/web/.env`)
| Variable | Type | Required (Prod) | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `string` | Yes | Base URL to backend API |
| `VITE_SUPABASE_URL` | `string` | Yes | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | `string` | Yes | Supabase Anon key |

---

## 3. Build & Startup Procedures

```bash
# 1. Install root dependencies
npm install

# 2. Build backend
npm run build --workspace=@nearvia/api

# 3. Build frontend
npm run build --workspace=@nearvia/web

# 4. Start production backend
npm start --workspace=@nearvia/api
```
