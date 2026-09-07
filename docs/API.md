# NEARVIA — REST API SPECIFICATION REFERENCE

> **Document Version**: 2.0.0  
> **Base Path**: `/api/v1`  
> **Protocol**: HTTPS / RESTful JSON  
> **Authentication**: HTTP Bearer Token (`Authorization: Bearer <jwt_token>`)  
> **Security Standards**: Parameterized SQL, Zod schema validation, CORS origin whitelisting, role-gated RBAC.

---

## 1. Authentication & Session Endpoints (`/api/v1/auth`)

### 1.1 Request OTP
- **Method & Path**: `POST /api/v1/auth/request-otp`
- **Access Level**: Public (Rate Limited: 6 requests / 15 minutes)
- **Request Body**:
  ```json
  {
    "phone": "+919876543210"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "OTP sent successfully",
    "expiresInSeconds": 600
  }
  ```
- **Error Responses**: `400 Bad Request` (Invalid E.164 phone format), `429 Too Many Requests`.

### 1.2 Verify OTP & Login
- **Method & Path**: `POST /api/v1/auth/verify-otp`
- **Access Level**: Public
- **Request Body**:
  ```json
  {
    "phone": "+919876543210",
    "otp": "123456"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "token": "<jwt_access_token>",
    "user": {
      "id": "c1f72e90-0000-0000-0000-000000000001",
      "phone": "+919876543210",
      "role": "WORKER",
      "fullName": "Ramesh Kumar",
      "isActive": true
    }
  }
  ```
- **Error Responses**: `401 Unauthorized` (Invalid or expired OTP), `403 Forbidden` (User account deactivated).

---

## 2. Jobs & Hyperlocal Discovery (`/api/v1/jobs`)

### 2.1 Hyperlocal Work Discovery
- **Method & Path**: `GET /api/v1/jobs/discover`
- **Access Level**: Public / Authenticated (Workers)
- **Query Parameters**:
  - `lat` (number, required): Geodesic latitude (e.g. `12.9716`)
  - `lng` (number, required): Geodesic longitude (e.g. `77.5946`)
  - `radiusKm` (number, optional): Search radius in km (default: `5`, max: `25`)
  - `categoryId` (UUID, optional): Filter by category
  - `workType` (string, optional): `SHIFT` | `TASK` | `FLEXI`
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "f5e4d3c2-0000-0000-0000-000000000001",
      "title": "Evening Sweet Box Packing",
      "categoryName": "Retail & Shop Assistance",
      "durationHours": 5.0,
      "paymentAmount": 750.0,
      "paymentType": "DAILY",
      "urgency": "NORMAL",
      "distanceMeters": 420.5,
      "approximateAddress": "Indiranagar 100ft Road",
      "status": "PUBLISHED",
      "workDate": "2026-09-04",
      "startTime": "2026-09-04T17:00:00+05:30"
    }
  ]
  ```

### 2.2 Post New Work Opportunity
- **Method & Path**: `POST /api/v1/jobs`
- **Access Level**: Authenticated (`role: PROVIDER`)
- **Request Body**:
  ```json
  {
    "title": "Inventory Helper",
    "description": "Unloading carton boxes in warehouse",
    "categoryId": "b2c3d4e5-0000-0000-0000-000000000001",
    "workType": "SHIFT",
    "urgency": "NORMAL",
    "workersNeeded": 2,
    "paymentAmount": 800.0,
    "paymentType": "DAILY",
    "workDate": "2026-09-05",
    "startTime": "2026-09-05T09:00:00+05:30",
    "endTime": "2026-09-05T17:00:00+05:30",
    "durationHours": 8.0,
    "latitude": 12.9352,
    "longitude": 77.6245,
    "addressApproximate": "Koramangala 5th Block",
    "skillIds": ["s1f2e3d4-0000-0000-0000-000000000001"]
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "id": "opp_999",
    "status": "DRAFT",
    "title": "Inventory Helper"
  }
  ```

### 2.3 Publish Work Opportunity
- **Method & Path**: `POST /api/v1/jobs/:id/publish`
- **Access Level**: Authenticated (`role: PROVIDER`, Job Owner)
- **Success Response (200 OK)**:
  ```json
  {
    "id": "opp_999",
    "status": "PUBLISHED",
    "publishedAt": "2026-09-03T15:00:00+05:30"
  }
  ```
- **Error Responses**: `400 Bad Request` (Job is not in DRAFT status), `403 Forbidden` (Not the job owner).

---

## 3. Applications & Candidate Matching

### 3.1 Worker Submits Application
- **Method & Path**: `POST /api/v1/jobs/:id/apply`
- **Access Level**: Authenticated (`role: WORKER`)
- **Request Body**:
  ```json
  {
    "workerNotes": "I have 3 years of packing experience and live 1 km away."
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "id": "app_888",
    "status": "PENDING",
    "workOpportunityId": "opp_999"
  }
  ```

### 3.2 Provider Accepts Application & Creates Assignment
- **Method & Path**: `POST /api/v1/applications/:id/accept`
- **Access Level**: Authenticated (`role: PROVIDER`, Job Owner)
- **Success Response (200 OK)**:
  ```json
  {
    "applicationId": "app_888",
    "status": "ACCEPTED",
    "assignmentId": "asn_777",
    "agreedWage": 800.0
  }
  ```

### 3.3 Explainable Candidate Recommendations
- **Method & Path**: `GET /api/v1/jobs/:id/recommended-workers`
- **Access Level**: Authenticated (`role: PROVIDER`, Job Owner)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "workerId": "wrk_123",
      "fullName": "Suresh Gowda",
      "compositeScore": 0.88,
      "distanceMeters": 650,
      "skillOverlapPercentage": 100,
      "averageRating": 4.9,
      "reliabilityScore": 0.95,
      "isAvailableNow": true,
      "explanation": "Top match: Required skill verified, 650m away, 4.9 stars, available now"
    }
  ]
  ```

---

## 4. Work Execution & Attendance (`/api/v1/assignments`)

### 4.1 Worker Confirms Shift
- **Method & Path**: `POST /api/v1/assignments/:id/confirm`
- **Access Level**: Authenticated (`role: WORKER`, Assigned Worker)
- **Success Response (200 OK)**:
  ```json
  {
    "id": "asn_777",
    "status": "CONFIRMED",
    "confirmedAt": "2026-09-03T15:10:00+05:30"
  }
  ```

### 4.2 GPS Geofence Check-In
- **Method & Path**: `POST /api/v1/assignments/:id/check-in`
- **Access Level**: Authenticated (`role: WORKER`)
- **Request Body**:
  ```json
  {
    "latitude": 12.9351,
    "longitude": 77.6244
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "id": "asn_777",
    "status": "CHECKED_IN",
    "checkedInAt": "2026-09-03T15:15:00+05:30",
    "distanceMeters": 18.2,
    "isWithinGeofence": true
  }
  ```
- **Error Responses**: `400 Bad Request` (Distance $> 1000\text{m}$ without valid override).

### 4.3 Provider Marks Shift Complete
- **Method & Path**: `POST /api/v1/assignments/:id/complete`
- **Access Level**: Authenticated (`role: PROVIDER`)
- **Success Response (200 OK)**:
  ```json
  {
    "id": "asn_777",
    "status": "COMPLETED",
    "completedAt": "2026-09-03T19:00:00+05:30"
  }
  ```

---

## 5. Payments & Financial Webhooks (`/api/v1/payments`)

### 5.1 Direct Cash Payment Confirmation
- **Method & Path**: `POST /api/v1/payments/cash-confirm`
- **Access Level**: Authenticated (`role: PROVIDER` or `role: WORKER`)
- **Request Body**:
  ```json
  {
    "assignmentId": "asn_777",
    "notes": "Direct cash paid on site"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "paymentRecordId": "pay_555",
    "status": "CONFIRMED",
    "method": "CASH",
    "amount": 800.0,
    "statement": "Cash payment confirmed between provider and worker"
  }
  ```

### 5.2 Razorpay Order Creation (Sandbox)
- **Method & Path**: `POST /api/v1/payments/create-order`
- **Access Level**: Authenticated (`role: PROVIDER`)
- **Request Body**:
  ```json
  {
    "assignmentId": "asn_777"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "gatewayOrderId": "order_KzX99abc",
    "amountPaise": 80000,
    "currency": "INR",
    "keyId": "rzp_test_sampleKey123"
  }
  ```

### 5.3 Gateway Webhook Handler
- **Method & Path**: `POST /api/v1/payments/webhook`
- **Access Level**: Public (Restricted to Gateway IP & HMAC Signature Verification)
- **Headers**:
  - `X-Razorpay-Signature`: Hex-encoded HMAC-SHA256 digest
- **Success Response (200 OK)**:
  ```json
  {
    "received": true
  }
  ```
- **Error Responses**: `400 Bad Request` (Invalid HMAC signature), `200 OK` (Ignored duplicated replay event).

---

## 6. Safety, Reviews, Admin & Auditing

### 6.1 Submit Two-Sided Review
- **Method & Path**: `POST /api/v1/reviews`
- **Access Level**: Authenticated (`WORKER` or `PROVIDER`)
- **Request Body**:
  ```json
  {
    "assignmentId": "asn_777",
    "rating": 5,
    "comments": "Punctual and very efficient with packaging boxes."
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "id": "rev_333",
    "rating": 5
  }
  ```

### 6.2 Admin Overview Dashboard
- **Method & Path**: `GET /api/v1/admin/overview`
- **Access Level**: Authenticated (`role: ADMIN`)
- **Success Response (200 OK)**:
  ```json
  {
    "totalUsers": 1420,
    "activeWorkers": 850,
    "activeProviders": 410,
    "publishedOpportunities": 310,
    "completedAssignments": 1120,
    "totalGrossMarketplaceValue": 896000.0,
    "openDisputesCount": 2
  }
  ```

### 6.3 System Health Checks
- **Method & Path**: `GET /health` and `GET /health/deep`
- **Access Level**: Public
- **Success Response (200 OK)**:
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "postgis": "available (3.3)",
    "timestamp": "2026-09-03T15:30:00.000Z"
  }
  ```
