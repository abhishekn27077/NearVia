# ADR-004: Hyperlocal 5 KM Default Operating Model and Privacy Fuzzing

## Status

Accepted

## Context

Short-duration tasks, micro-shifts, and emergency temporary replacements require instant physical reachability. Workers cannot spend 1-2 hours commuting for a 2-hour task. Furthermore, worker location privacy must be protected from unauthorized tracking.

## Decision

We enforce a default **5 km hyperlocal search radius** (configurable up to a strict maximum of 15 km). All search queries use bounding box pre-filtering followed by exact PostGIS `ST_DWithin` spatial checks. For privacy, worker coordinates are never broadcast publicly; public search listings return approximate location zones until an assignment is confirmed.

## Alternatives Considered

1. **City-wide / Regional radius (25-50 km)**: Rejected because transit time makes short-duration micro-tasks and fast time-to-fill unviable.
2. **Exact live GPS coordinate broadcasting**: Rejected due to privacy, stalker risks, and personal safety hazards for local workers.

## Consequences

- **Positive**: High fill rates; rapid arrival times; realistic daily travel for workers; robust privacy and safety standards.
- **Negative**: Requires sufficient local worker/provider density in launch neighborhoods.
