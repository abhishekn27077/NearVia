# NEARVIA Mobile Application Workspace

## Status: Reserved for Future Phase

This workspace (`apps/mobile`) is reserved for the NEARVIA mobile client application, which will be implemented in its designated phase.

### Architectural Rules for Mobile Implementation

1. **Reuse Shared Contracts**: The mobile application must import and reuse:
   - `@nearvia/types` for domain models, state enums, and API contracts.
   - `@nearvia/validation` for client-side input validations.
   - `@nearvia/config` for system constants, distance thresholds, and error codes.
   - `@nearvia/shared` for Haversine distance calculations, date conversions, and formatting.
2. **Zero Duplication**: Do NOT duplicate backend business logic, validation rules, or spatial algorithms inside the mobile client.
3. **API Consumer**: All actions (discovering jobs, toggling Available-Now, applying, submitting reviews) must be conducted via the central REST backend service (`services/api`).
