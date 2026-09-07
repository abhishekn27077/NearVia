# NEARVIA End-to-End (E2E) Testing Strategy

> **Document Version**: 1.0.0  
> **Status**: Approved Infrastructure Specification (Phase 2)  
> **Project**: NEARVIA — _Work Within Reach_

---

## 1. Overview

This directory is reserved for end-to-end multi-tier integration scenarios. E2E tests simulate complete cross-role journeys across the responsive web app, REST backend, Supabase Auth, and PostGIS spatial database.

---

## 2. Planned E2E Scenarios by Role

### 1. Worker Core Journey

$$\text{Register} \longrightarrow \text{KYC Profile} \longrightarrow \text{Set "Available-Now"} \longrightarrow \text{Discover 5km Task} \longrightarrow \text{Quick Apply} \longrightarrow \text{Execute Assignment} \longrightarrow \text{Rate}$$

### 2. Job Provider Core Journey

$$\text{Register} \longrightarrow \text{Post Micro-Task Wizard} \longrightarrow \text{Discover Nearby Workers} \longrightarrow \text{Select & Assign} \longrightarrow \text{Confirm Completion} \longrightarrow \text{Record Payout}$$

### 3. Local Agent Assisted Journey

$$\text{Register Low-Literacy Worker} \longrightarrow \text{Inspect Locality Feed} \longrightarrow \text{Assisted Apply on Worker's Behalf} \longrightarrow \text{Track Connection}$$

### 4. Admin Operations Journey

$$\text{Review KYC Queue} \longrightarrow \text{Moderate Flagged Task} \longrightarrow \text{Arbitrate Dispute Ticket} \longrightarrow \text{Inspect Telemetry}$$

---

## 3. Tooling Roadmap

Future implementation will use Playwright for browser journey automation against staging and ephemeral test environments.
