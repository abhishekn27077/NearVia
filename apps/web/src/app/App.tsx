import React from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "../routes";
import { ErrorBoundary } from "./ErrorBoundary";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <RouterProvider router={router} />
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};
