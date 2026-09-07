# ADR-006: Unified Backend and Shared Contracts for Web and Mobile

## Status

Accepted

## Context

NEARVIA will support both a Responsive Web Application and a Mobile Client Application. Duplicate definitions of data models, validation logic, and business workflows lead to version drift, inconsistent user behavior, and maintenance overhead.

## Decision

We enforce a **Unified Backend API and Shared Monorepo Package Strategy**:

1. All client applications (`apps/web` and `apps/mobile`) consume the single canonical REST API (`services/api`).
2. Domain types (`@nearvia/types`), input validations (`@nearvia/validation`), constants (`@nearvia/config`), and common utilities (`@nearvia/shared`) are maintained in shared packages.
3. No domain or business logic is duplicated inside frontend or mobile codebases.

## Alternatives Considered

1. **Backend-for-Frontend (BFF) Pattern**: Rejected as unnecessary overhead for current product scope; REST API endpoints are designed to be clean and comprehensive.
2. **Independent standalone mobile repository**: Rejected because separate repositories complicate synchronized contract updates and type sharing.

## Consequences

- **Positive**: Single source of truth for types and business constraints; 100% code reuse for validation and shared helpers; frictionless multi-client evolution.
- **Negative**: Monorepo tooling and workspace configurations must remain strictly maintained.
