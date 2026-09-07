# NEARVIA Environment & Secret Management Specification

> **Document Version**: 1.0.0  
> **Status**: Approved Infrastructure Specification (Phase 2)  
> **Project**: NEARVIA — _Work Within Reach_

---

## 1. Environment Policy & Security Manifesto

1. **Zero Committed Secrets**: Never commit `.env`, `.env.local`, `.env.production`, private keys, database passwords, or third-party service tokens to Git.
2. **Single Template Source**: `.env.example` at the repository root is the canonical template containing variable keys and placeholder descriptions only.
3. **Strict Validation**: All backend environment variables are loaded and validated on startup in `services/api/src/config/index.ts` using Zod. The service will fail fast with a clear diagnostic message if required configuration is missing.

---

## 2. Environment Matrix

### 2.1 Variables Catalog

| Variable Name               | Environment |      Default Value      | Description                                                |
| :-------------------------- | :---------: | :---------------------: | :--------------------------------------------------------- |
| `NODE_ENV`                  |     All     |      `development`      | Runtime environment (`development`, `test`, `production`). |
| `PORT`                      | Dev / Prod  |         `4000`          | HTTP port for the backend REST API service.                |
| `API_HOST`                  | Dev / Prod  |       `localhost`       | Host interface for backend server binding.                 |
| `CORS_ORIGIN`               | Dev / Prod  | `http://localhost:3000` | Allowed CORS origin (comma-separated or `*` in dev).       |
| `DATABASE_URL`              | Dev / Prod  |     _(Placeholder)_     | PostgreSQL + PostGIS connection string.                    |
| `SUPABASE_URL`              | Dev / Prod  |     _(Placeholder)_     | Supabase project API gateway URL.                          |
| `SUPABASE_ANON_KEY`         | Dev / Prod  |     _(Placeholder)_     | Supabase public anonymous key (for client sessions).       |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev / Prod  |     _(Placeholder)_     | Supabase administrative service role key.                  |
| `MAP_DEFAULT_RADIUS_KM`     |     All     |           `5`           | Hyperlocal spatial radius default in kilometers.           |
| `MAP_MAX_RADIUS_KM`         |     All     |          `15`           | Maximum allowed spatial search radius.                     |
| `VITE_API_BASE_URL`         |     Web     |        `/api/v1`        | Base URL used by the web client to contact the API.        |

---

## 3. Environment Setup by Tier

### Development Environment

1. Copy the template:
   ```bash
   cp .env.example .env
   ```
2. Adjust local ports or local PostgreSQL credentials if running a local database instance.
3. Start development servers:
   ```bash
   npm run dev:api
   npm run dev:web
   ```

### Test Environment

- Automated test runs (`vitest`) set `NODE_ENV=test`.
- Database operations in future phases will target a dedicated test database container or isolated schema.

### Production Environment (Render / Vercel)

- Environment variables must be configured directly within the hosting provider's secure management dashboard.
- `NODE_ENV` must be set to `production`.
- `CORS_ORIGIN` must point strictly to the production web application domain.
