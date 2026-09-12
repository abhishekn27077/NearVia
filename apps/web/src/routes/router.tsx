import { createBrowserRouter } from "react-router-dom";
import { UserRole } from "@nearvia/types";
import { RootLayout } from "../components/layout";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import {
  HomePage,
  NotFoundPage,
  LoginPage,
  RegisterPage,
  WorkerDashboardPage,
  ProviderDashboardPage,
  AgentDashboardPage,
} from "../pages";
import {
  WorkerProfilePage,
  WorkerSkillsPage,
  WorkerAvailabilityPage,
  WorkerAgentsPage,
} from "../features/workers";
import {
  ProviderProfilePage,
  ProviderWorkListPage,
  CreateWorkOpportunityPage,
  WorkOpportunityDetailPage,
  EditWorkOpportunityPage,
} from "../features/providers";
import { FindWorkPage } from "../features/discovery";
import {
  WorkerApplicationsPage,
  OpportunityApplicantsPage,
} from "../features/applications";
import {
  WorkerAssignmentsPage,
  WorkerAssignmentDetailPage,
  ProviderAssignmentsPage,
  ProviderAssignmentDetailPage,
  ShareActiveJobPage,
} from "../features/assignments";
import {
  AgentWorkerDetailPage,
  AgentWorkDiscoveryPage,
} from "../features/agents";
import {
  WorkerEarningsPage,
  WorkerTransactionsPage,
  ProviderPaymentsPage,
} from "../features/payments";
import {
  DisputesListPage,
  DisputeDetailPage,
  ReportsHistoryPage,
} from "../features/safety";
import { MessagesPage } from "../features/messages";
import { VerificationCenterPage } from "../features/verification";
import { WorkforceRadarPage } from "../features/radar";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
      {
        path: "share/job/:id",
        element: <ShareActiveJobPage />,
      },
      {
        path: "radar",
        element: (
          <ProtectedRoute>
            <WorkforceRadarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "workforce-radar",
        element: (
          <ProtectedRoute>
            <WorkforceRadarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/radar",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkforceRadarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/radar",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <WorkforceRadarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "agent/radar",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
            <WorkforceRadarPage />
          </ProtectedRoute>
        ),
      },
      // Worker Role-Protected Routes
      {
        path: "worker/dashboard",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/profile",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/skills",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerSkillsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/availability",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerAvailabilityPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/find-work",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <FindWorkPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/applications",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerApplicationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/assignments",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerAssignmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/assignments/:id",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerAssignmentDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/agents",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerAgentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/earnings",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerEarningsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/transactions",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <WorkerTransactionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "worker/verification",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.WORKER]}>
            <VerificationCenterPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/verification",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <VerificationCenterPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "agent/verification",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
            <VerificationCenterPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "verification",
        element: (
          <ProtectedRoute>
            <VerificationCenterPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "find-work",
        element: <FindWorkPage />,
      },
      // Provider Role-Protected Routes
      {
        path: "provider/dashboard",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <ProviderDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/profile",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <ProviderProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/work",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <ProviderWorkListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/work/new",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <CreateWorkOpportunityPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/work/:id",
        element: <WorkOpportunityDetailPage />,
      },
      {
        path: "provider/work/:id/edit",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <EditWorkOpportunityPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/work/:id/applicants",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <OpportunityApplicantsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/assignments",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <ProviderAssignmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/assignments/:id",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <ProviderAssignmentDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "provider/payments",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.PROVIDER]}>
            <ProviderPaymentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "agent/dashboard",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
            <AgentDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "agent/workers/:workerId",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
            <AgentWorkerDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "agent/workers/:workerId/find-work",
        element: (
          <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
            <AgentWorkDiscoveryPage />
          </ProtectedRoute>
        ),
      },
      // Shared Authenticated Safety & Dispute Routes
      {
        path: "disputes",
        element: (
          <ProtectedRoute>
            <DisputesListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "disputes/:id",
        element: (
          <ProtectedRoute>
            <DisputeDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "reports/mine",
        element: (
          <ProtectedRoute>
            <ReportsHistoryPage />
          </ProtectedRoute>
        ),
      },
      // Shared Authenticated Messaging Routes
      {
        path: "messages",
        element: (
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "messages/:conversationId",
        element: (
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
