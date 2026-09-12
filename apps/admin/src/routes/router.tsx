import { createBrowserRouter, Navigate } from "react-router-dom";
import { AdminLoginPage } from "../pages/AdminLoginPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { WorkforceRadarPage } from "../features/radar/WorkforceRadarPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProtectedAdminRoute } from "../components/auth/ProtectedAdminRoute";
import { AdminLayout } from "../components/layout/AdminLayout";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <AdminLoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedAdminRoute>
        <AdminLayout />
      </ProtectedAdminRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <AdminDashboardPage />,
      },
      {
        path: "radar",
        element: <WorkforceRadarPage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
