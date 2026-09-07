import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { NearviaBottomNav } from "./NearviaBottomNav";
import { LoadingFallback } from "../../app/LoadingFallback";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { VoiceAssistantWidget } from "../../features/intelligence";

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF9] text-slate-900 selection:bg-orange-500 selection:text-white font-sans antialiased relative overflow-hidden">
      {/* Ambient Gradient Orbs */}
      <div className="orb-gradient orb-orange" />
      <div className="orb-gradient orb-blue" />
      <Header />
      <main className="flex-1 flex flex-col pt-24 pb-20 md:pb-0 relative z-10">
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <NearviaBottomNav />
      {/* Multilingual Voice & Low-Literacy Assistant */}
      <VoiceAssistantWidget />
    </div>
  );
};
