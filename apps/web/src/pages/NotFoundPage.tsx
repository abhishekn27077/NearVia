import React from "react";
import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { webConfig } from "../config";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full p-8 rounded-2xl bg-slate-800/60 backdrop-blur-md border border-slate-700/60 shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
          <Compass className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">404</h1>
        <h2 className="text-lg font-semibold text-slate-200 mb-3">
          Page Out of Reach
        </h2>
        <p className="text-sm text-slate-400 mb-8">
          The page you are looking for does not exist or has been moved. Return
          to {webConfig.appName} home to discover nearby work.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center space-x-2 w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
};
