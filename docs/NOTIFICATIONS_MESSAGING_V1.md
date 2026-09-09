# NEARVIA: Notifications + Messaging Architecture (V1)

## Overview
Phase 16 implements a reliable, free-first in-app notification and job-related messaging system for NEARVIA. It connects participants (Workers, Providers, Agents, and Administrators) across real platform events using PostgreSQL storage, secure REST endpoints, Supabase realtime channels, and resilient client-side polling.

---

## 1. Notification Event Types & Recipients

All notifications are strictly routed server-side based on database relationships and business event actors. The backend determines the recipient; clients cannot specify or spoof `recipient_id`.

| Notification Type | Target Recipient | Trigger Event | Deep Link Context |
| :--- | :--- | :--- | :--- |
| `NEW_APPLICATION` | Provider | Worker submits application | `workOpportunityId`, `applicationId` |
| `APPLICATION_SHORTLISTED` | Worker | Provider shortlists candidate | `workOpportunityId`, `applicationId` |
| `APPLICATION_ACCEPTED` | Worker | Provider accepts applicant (hired) | `workOpportunityId`, `assignmentId` |
| `AGENT_WORKER_HIRED` | Agent | Assisted worker is hired | `workOpportunityId`, `assignmentId`, `workerId` |
| `APPLICATION_REJECTED` | Worker | Provider declines applicant | `workOpportunityId`, `applicationId` |
| `WORKER_CONFIRMED` | Provider | Worker confirms shift attendance | `workOpportunityId`, `assignmentId` |
| `WORKER_CHECKED_IN` | Provider | Worker arrives & checks in | `workOpportunityId`, `assignmentId` |
| `WORKER_COMPLETED` | Provider | Worker completes shift work | `workOpportunityId`, `assignmentId` |
| `COMPLETION_CONFIRMED` | Worker | Provider approves completion | `workOpportunityId`, `assignmentId` |
| `ASSIGNMENT_CANCELLED` | Counterparty | Participant cancels assignment | `workOpportunityId`, `assignmentId` |
| `CASH_PAYMENT_INITIATED` | Worker | Cash settlement initiated with PIN | `assignmentId`, `amount`, `jobPin` |
| `CASH_PAYMENT_CONFIRMED` | Worker & Provider | Cash handover verified via PIN | `assignmentId`, `amount` |
| `ONLINE_PAYMENT_CONFIRMED` | Worker & Provider | Razorpay order captured | `assignmentId`, `paymentId` |
| `PAYMENT_FAILED` | Provider | Digital payment failed | `assignmentId`, `error` |
| `NEW_DISPUTE` | Respondent | Dispute filed on job | `disputeId`, `assignmentId` |
| `DISPUTE_RESOLVED` | Worker & Provider | Admin resolves dispute | `disputeId`, `resolution` |
| `NEW_REPORT` | Admin | Abuse/safety report submitted | `reportId`, `targetType` |
| `NEW_MESSAGE` | Recipient | New in-app chat message received | `conversationId`, `workOpportunityId` |
| `AGENT_ACCESS_REQUEST` | Worker | Agent requests access link | `agentId`, `relationshipId` |
| `AGENT_ACCESS_ACCEPTED` | Agent | Worker accepts agent assistance | `workerId`, `relationshipId` |
| `AGENT_ACCESS_REVOKED` | Agent | Worker revokes agent assistance | `workerId`, `relationshipId` |

---

## 2. Notification Security & Deduplication

1. **Server-Side Recipient Enforcement**:
   - `recipient_id` is queried from authoritative tables (`provider_profiles.user_id`, `worker_profiles.user_id`, `agent_profiles.user_id`, `conversations`).
   - No public endpoint accepts `recipient_id` in request payloads.
2. **Access Control on Status**:
   - `PATCH /api/v1/notifications/:id/read`: Validates that `recipient_id === req.user.id`. If a user attempts to mark another user's notification as read, the API immediately throws `403 Forbidden` (`You cannot mark another user's notification as read.`). If the notification ID does not exist, `404 Not Found` is returned.
   - `GET /api/v1/notifications`: Returns only notifications where `recipient_id = req.user.id`.
   - `GET /api/v1/notifications/unread-count`: Lightweight query returning total unread count for badge rendering.
3. **Idempotency & Deduplication**:
   - Explicit `eventId` checking suppresses duplicate events generated from retries.
   - Automatic 2-minute sliding window suppresses duplicate job/assignment events with identical `(recipient_id, type, workOpportunityId/assignmentId)`.

---

## 3. Messaging Authorization & Privacy Boundaries

### Valid Conversation Relationships
Conversations are strictly bound to a specific `work_opportunity_id` between:
1. The **Job Provider** (`provider_profiles.user_id`).
2. The **Assigned or Applying Worker** (`worker_profiles.user_id`).
3. An **Assisting Agent** holding an `ACTIVE` relationship with the worker (`agent_worker_relationships.status = 'ACTIVE'`).

Arbitrary users cannot initiate conversations. A valid application or assignment record is required to create a conversation:
```sql
SELECT EXISTS (
  SELECT 1 FROM applications WHERE work_opportunity_id = $1 AND worker_id = $2
  UNION
  SELECT 1 FROM assignments WHERE work_opportunity_id = $1 AND worker_id = $2
) AS has_rel;
```

### Privacy Safeguards
- **Recipient Derivation**: When a participant calls `POST /api/v1/messages/conversations/:id/messages`, the recipient is derived server-side from the conversation record (`conv.workerUserId === senderUserId ? conv.providerUserId : conv.workerUserId`). Clients cannot specify the recipient.
- **Data Minimization**: Message bodies only include sanitized text (`1..2000` characters). Phone numbers, email addresses, exact GPS coordinates, and KYC identity documents are never leaked in conversation responses.
- **Rate Limiting**: `messagesLimiter` limits messages to 60 requests per 15-minute window per authenticated user.

---

## 4. Delivery Mechanism & Future Real-Time Roadmap

### Current V1 Implementation (Free-First)
- **Database Backing**: PostgreSQL tables `notifications`, `conversations`, and `messages` with B-tree indexes on `(recipient_id, is_read)`, `(conversation_id, created_at)`, and `(work_opportunity_id, worker_id)`.
- **Supabase Realtime**: Where supported, WebSocket subscriptions listen to table changes filtered by `recipient_id=eq.${user.id}` or `conversation_id=eq.${convId}`.
- **Resilient Polling**: Client components feature automatic fallback interval polling (15s for notifications, 5s for active chat thread) ensuring reliable operation when WebSockets are disconnected or offline.

### Future Real-Time Roadmap (V2+)
- **Web Push Notifications (VAPID / Service Workers)**: Background push notifications for Android/PWA when browser tab is closed.
- **Native Push (Firebase Cloud Messaging / Apple Push Notification Service)**: For React Native mobile companion apps.
- **WebSocket Gateway / SSE**: Dedicated SSE (Server-Sent Events) or Redis Pub/Sub for high-concurrency real-time delivery at national scale.
