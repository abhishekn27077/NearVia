# Mandatory AI Agent Development Rules for NEARVIA

All future AI coding agents working on the NEARVIA codebase MUST strictly adhere to these 20 development rules.

---

### The 20 Mandatory Rules

1. **Read `PROJECT_STATE.md` first**: Always review `PROJECT_STATE.md` before starting any task to know current phase, status, and active boundaries.
2. **Read relevant ADRs**: Review all Architecture Decision Records in `docs/decisions/` before modifying or proposing architectural changes.
3. **Inspect before creating**: Inspect existing module implementations, shared packages, and database migrations before adding new files.
4. **Never recreate existing features**: Reuse existing services, types, and utility functions instead of re-implementing them.
5. **Never create duplicate folders**: Maintain single sources of truth. Do not create parallel domain folders (e.g. do not create `src/job-module/` if `src/modules/jobs/` exists).
6. **Follow established folder structures**: Respect the modular monolith layout in `services/api/` and the feature-oriented structure in `apps/web/`.
7. **Scope strictly to the active phase**: Work exclusively on the current assigned phase.
8. **No premature implementations**: Do not silently implement features reserved for future phases.
9. **No unauthorized tech stack changes**: Do not introduce alternate frameworks or database engines without explicit human architect approval.
10. **Zero unnecessary dependencies**: Do not introduce Redis, Kafka, Kubernetes, blockchain, or heavy libraries unless explicitly justified.
11. **Maintain the Modular Monolith**: Do NOT split the backend into microservices.
12. **Zero secret exposure**: Never log, display, or commit tokens, service keys, or sensitive credentials.
13. **No hardcoded secrets in source code**: All configurable parameters must be loaded via environment variables and validated through configuration schemas.
14. **Preserve backward compatibility**: Ensure all new changes do not break previous phases or active contracts.
15. **Update test suites**: Write or update tests whenever domain logic, schemas, or endpoints are modified.
16. **Execute tests before completing**: Run `npm test`, `npm run typecheck`, and `npm run lint` before claiming task completion.
17. **Update `PROJECT_STATE.md`**: Update the status and phase logs in `PROJECT_STATE.md` upon completing each phase.
18. **Document decisions via ADRs**: Create an ADR in `docs/decisions/` for any significant architectural deviation or technical decision.
19. **Clean up scratch files**: Remove temporary test files, debug logs, and scratch scripts before committing work.
20. **Verify before claiming completion**: Never claim a feature or phase is complete without providing concrete test and build evidence.

---

### Token Efficiency Guidelines

- Do NOT scan the entire repository recursively unless executing a global refactor.
- Target only the relevant module in `services/api/src/modules/<feature>` and `apps/web/src/features/<feature>`.
- Check shared types in `packages/types` and validation in `packages/validation` first.
