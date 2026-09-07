/**
 * NEARVIA End-to-End Workflow Verification Script
 * Validates the complete hyperlocal work marketplace journey against live Supabase PostgreSQL:
 * 1. Worker & Provider authentication verification
 * 2. PostGIS 5 KM radius discovery
 * 3. Provider posting new work opportunity
 * 4. Worker discovery & application submission
 * 5. Provider applicant review & acceptance
 * 6. Assignment creation & status progression
 * 7. Rating & review completion
 */

import dotenv from "dotenv";
dotenv.config();

import { query } from "../db";
import { workOpportunitiesService } from "../modules/jobs/service";
import { discoveryService } from "../modules/jobs/discovery.service";
import { applicationsService } from "../modules/applications/service";
import { assignmentsService } from "../modules/assignments/service";
import { reviewsService } from "../modules/reviews/service";
import { WorkType, UrgencyLevel, PaymentType, WorkOpportunityStatus } from "@nearvia/types";

export async function runE2EWorkflowVerification(): Promise<void> {
  console.log("================================================================================");
  console.log("🚀 NEARVIA END-TO-END SUPABASE MARKETPLACE WORKFLOW VERIFICATION");
  console.log("================================================================================");

  // Step 1: Verify Demo Accounts exist in PostgreSQL
  console.log("\n[Step 1] Verifying Canonical Demo Accounts in PostgreSQL...");
  const workerUser = await query<{ id: string; auth_id: string; full_name: string; role: string; mobile_verified: boolean; identity_verified: boolean }>(
    "SELECT id, auth_id, full_name, role, mobile_verified, identity_verified FROM users WHERE email = 'demo.worker@nearvia.test'"
  );
  const providerUser = await query<{ id: string; auth_id: string; full_name: string; role: string }>(
    "SELECT id, auth_id, full_name, role FROM users WHERE email = 'demo.provider@nearvia.test'"
  );

  if (!workerUser.rows[0] || !providerUser.rows[0]) {
    throw new Error("Demo accounts not found in database. Run npm run seed:demo first.");
  }

  const worker = workerUser.rows[0];
  const provider = providerUser.rows[0];
  console.log(` ✓ Worker: ${worker.full_name} (${worker.id}) | Role: ${worker.role} | Mobile Verified: ${worker.mobile_verified} | ID Verified: ${worker.identity_verified}`);
  console.log(` ✓ Provider: ${provider.full_name} (${provider.id}) | Role: ${provider.role}`);

  // Fetch provider profile ID
  const providerProfileRes = await query<{ id: string }>(
    "SELECT id FROM provider_profiles WHERE user_id = $1",
    [provider.id]
  );
  const providerProfileId = providerProfileRes.rows[0]?.id;
  if (!providerProfileId) throw new Error("Provider profile not found");

  // Fetch worker profile ID
  const workerProfileRes = await query<{ id: string }>(
    "SELECT id FROM worker_profiles WHERE user_id = $1",
    [worker.id]
  );
  const workerProfileId = workerProfileRes.rows[0]?.id;
  if (!workerProfileId) throw new Error("Worker profile not found");

  // Step 2: Provider Posts a New Work Opportunity
  console.log("\n[Step 2] Provider Posting Work Opportunity ('Artisanal Bakery Evening Assistant')...");
  const createdJob = await workOpportunitiesService.createWorkOpportunity(
    provider.id,
    {
      categoryId: "a0000001-0000-0000-0000-000000000001",
      title: "Artisanal Bakery Evening Assistant (E2E Test)",
      description: "Assist with boxing orders, counter customer service, and daily tray organization during peak evening hours.",
      status: WorkOpportunityStatus.DRAFT,
      minExperienceYears: 0,
      workType: WorkType.TASK,
      urgency: UrgencyLevel.NORMAL,
      workersNeeded: 1,
      location: {
        latitude: 12.9784,
        longitude: 77.6408,
      },
      addressApproximate: "100ft Road, Indiranagar, Bengaluru",
      workDate: new Date().toISOString().split("T")[0]!,
      startTime: "16:00:00",
      endTime: "18:00:00",
      durationHours: 2.0,
      paymentAmount: 350.0,
      paymentType: PaymentType.FIXED,
      currency: "INR",
      responsibilities: "Help counter packaging, box baked breads, greet customers.",
      instructions: "Wear comfortable shoes. Apron provided on-site.",
      toolsProvided: true,
      orientationProvided: true,
      skills: [
        {
          skillId: "b0000001-0000-0000-0000-000000000006", // General Helper
          isRequired: true,
          minExperienceYears: 1.0,
        },
      ],
    },
  );

  // Publish Job
  const publishedJob = await workOpportunitiesService.publishWorkOpportunity(createdJob.id, provider.id);
  console.log(` ✓ Job Created & Published: "${publishedJob.title}" (ID: ${publishedJob.id})`);
  console.log(` ✓ Wage: ₹${publishedJob.paymentAmount} for ${publishedJob.durationHours} hours | Status: ${publishedJob.status}`);

  // Step 3: Worker Performs 5 KM Spatial Discovery (Domlur -> Indiranagar)
  console.log("\n[Step 3] Worker Searching for Work within 5 KM Radius (PostGIS ST_DWithin)...");
  const searchResult = await discoveryService.discoverNearbyWork(
    worker.id,
    {
      latitude: 12.9610, // Domlur
      longitude: 77.6372,
      radiusKm: 5.0,
    },
  );

  console.log(` ✓ PostGIS Spatial Query Returned: ${searchResult.total} nearby opportunities within 5.0 KM`);
  const foundOpportunity = searchResult.opportunities.find((o) => o.id === publishedJob.id);
  if (!foundOpportunity) {
    throw new Error(`Published job ${publishedJob.id} was not found in 5 KM radius search!`);
  }
  console.log(` ✓ Located Target Job: "${foundOpportunity.title}" at distance: ${foundOpportunity.distanceKm.toFixed(2)} KM`);

  // Step 4: Worker Submits Application
  console.log("\n[Step 4] Worker Suresh Patel Submitting Application...");
  // Clear any existing application if re-running
  await query("DELETE FROM applications WHERE work_opportunity_id = $1 AND worker_id = $2", [publishedJob.id, workerProfileId]);
  
  const application = await applicationsService.applyForWork(
    worker.id,
    publishedJob.id,
    {
      workerNotes: "I have 3 years of retail and bakery helper experience in Indiranagar.",
    },
  );
  console.log(` ✓ Application Submitted: ID ${application.id} | Status: ${application.status}`);

  // Step 5: Provider Reviews & Accepts Application
  console.log("\n[Step 5] Provider Ramesh Kumar Reviewing & Accepting Application...");
  const selectResult = await applicationsService.acceptApplication(
    provider.id,
    application.id,
  );
  console.log(` ✓ Application Accepted: Worker Selected -> Assignment ID: ${selectResult.assignmentId}`);

  // Step 6: Verify Assignment Created & Progress Workflow
  console.log("\n[Step 6] Progressing Shift Lifecycle (ASSIGNED -> CONFIRMED -> CHECKED_IN -> IN_PROGRESS -> COMPLETED)...");
  const assignmentId = selectResult.assignmentId;

  // Confirm
  const confirmed = await assignmentsService.confirmAssignment(worker.id, assignmentId);
  console.log(` ✓ Worker Confirmed Shift: Status -> ${confirmed.status}`);

  // Check in
  const checkedIn = await assignmentsService.checkIn(worker.id, assignmentId, {
    latitude: 12.9784,
    longitude: 77.6408,
  });
  console.log(` ✓ Worker Checked In at Location: Status -> ${checkedIn.status}`);

  // Start work
  const started = await assignmentsService.startWork(worker.id, assignmentId, {});
  console.log(` ✓ Worker Started Shift: Status -> ${started.status}`);

  // Complete work
  const completed = await assignmentsService.completeWork(worker.id, assignmentId, {
    completionNotes: "All bread shelves stocked and evening takeout packaging finished.",
  });
  console.log(` ✓ Worker Completed Shift: Status -> ${completed.status}`);

  // Provider confirms completion
  const providerConfirmed = await assignmentsService.confirmCompletion(provider.id, assignmentId, {
    feedback: "Excellent job done by Suresh. Highly recommended.",
  });
  console.log(` ✓ Provider Confirmed Shift Completion: Status -> ${providerConfirmed.status}`);

  // Step 7: Ratings & Reviews
  console.log("\n[Step 7] Submitting Reciprocal 5-Star Reviews in Supabase...");
  const workerReview = await reviewsService.submitReview(
    assignmentId,
    worker.id,
    {
      rating: 5,
      comments: "Great bakery environment and clear instructions from Ramesh.",
    },
  );
  console.log(` ✓ Worker reviewed Provider: ${workerReview.rating} Stars ("${workerReview.comments}")`);

  const providerReview = await reviewsService.submitReview(
    assignmentId,
    provider.id,
    {
      rating: 5,
      comments: "Suresh was fast, reliable, and did an outstanding job.",
    },
  );
  console.log(` ✓ Provider reviewed Worker: ${providerReview.rating} Stars ("${providerReview.comments}")`);

  // Step 8: Cleanup test job
  console.log("\n[Step 8] Cleaning up temporary E2E test records...");
  await query("DELETE FROM reviews WHERE assignment_id = $1", [assignmentId]);
  await query("DELETE FROM assignments WHERE id = $1", [assignmentId]);
  await query("DELETE FROM applications WHERE id = $1", [application.id]);
  await query("DELETE FROM work_opportunity_skills WHERE work_opportunity_id = $1", [publishedJob.id]);
  await query("DELETE FROM work_opportunities WHERE id = $1", [publishedJob.id]);
  console.log(" ✓ Cleaned up temporary test opportunity.");

  console.log("\n================================================================================");
  console.log("🎉 ALL 8 E2E WORKFLOW PHASES VERIFIED WITH 100% SUCCESS ON SUPABASE POSTGRESQL");
  console.log("================================================================================");
}

if (require.main === module || process.argv[1]?.includes("e2e-workflow-verify")) {
  runE2EWorkflowVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ E2E Workflow Verification failed:", err);
      process.exit(1);
    });
}
