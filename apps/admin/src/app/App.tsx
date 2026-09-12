import React from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "../routes/router";
import { AdminAuthProvider } from "../context/AdminAuthContext";

export const App: React.FC = () => {
  return (
    <AdminAuthProvider>
      <RouterProvider router={router} />
    </AdminAuthProvider>
  );
};
