# ADR-005: Multi-Factor Deterministic Explainable Matching Engine

## Status

Accepted

## Context

Marketplace participants must understand why a specific match was recommended or ranked higher. Distance alone does not define a good match (e.g., an unqualified worker at 0.5 km is inferior to a skilled, available worker at 1.5 km). Black-box machine learning models introduce non-deterministic unpredictability and high latency in early product stages.

## Decision

We implement a **Deterministic, Multi-Factor Explainable Scoring Algorithm**. The matching engine scores candidates and tasks across five explicit dimensions:

1. **Skill Compatibility** (35% weight)
2. **Distance & Proximity** (25% weight, non-linear decay up to 5 km)
3. **Current Availability / "Available-Now" Status** (20% weight)
4. **Time Window Compatibility** (10% weight)
5. **Reputation & Reliability History** (10% weight)

Every match response returns a `scoreBreakdown` containing human-readable explanations for the assigned rank.

## Alternatives Considered

1. **Distance-only sorting**: Rejected because physical proximity without skill and time compatibility results in failed job assignments.
2. **Opaque Deep Neural Network / LLM Matching**: Rejected due to high inference cost, latency, lack of determinism, and inability to audit why matches fail.

## Consequences

- **Positive**: Auditable, sub-20ms scoring; transparent explanations for job providers and workers; easily tunable weights.
- **Negative**: Algorithmic weights require continuous empirical tuning based on marketplace feedback.
