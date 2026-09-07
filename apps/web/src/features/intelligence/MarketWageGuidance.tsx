import React, { useEffect, useState } from "react";
import { TrendingUp, HelpCircle, CheckCircle2 } from "lucide-react";
import { MarketWageBenchmark } from "@nearvia/types";

interface MarketWageGuidanceProps {
  categoryId?: string;
  currentWage: number;
  onSelectSuggestedRate?: (rate: number) => void;
}

export const MarketWageGuidance: React.FC<MarketWageGuidanceProps> = ({
  categoryId,
  currentWage,
  onSelectSuggestedRate,
}) => {
  const [benchmarks, setBenchmarks] = useState<MarketWageBenchmark[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      setLoading(true);
      try {
        const url = categoryId
          ? `/api/v1/intelligence/market/wages?categoryId=${categoryId}`
          : `/api/v1/intelligence/market/wages`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.success && json.data) {
          setBenchmarks(json.data);
        }
      } catch (err) {
        console.error("Failed to load market wage benchmarks", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBenchmarks();
  }, [categoryId]);

  if (loading || benchmarks.length === 0) return null;

  const currentBench = benchmarks.find((b) => b.categoryId === categoryId) || benchmarks[0];
  if (!currentBench) return null;

  const isCompetitive = currentWage >= currentBench.medianWage;

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-white">
            Market Wage Benchmark ({currentBench.categoryName})
          </span>
        </div>
        {currentWage > 0 && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              isCompetitive
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
            }`}
          >
            {isCompetitive ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Competitive Pay Rate
              </>
            ) : (
              <>
                <HelpCircle className="w-3 h-3" />
                Below Median Pay
              </>
            )}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-center">
        <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
          <span className="text-slate-400 block text-[10px]">25th Percentile</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            ₹{currentBench.p25Wage}
          </span>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-200 dark:border-indigo-900/60">
          <span className="text-indigo-600 dark:text-indigo-400 block text-[10px] font-semibold">
            Market Median
          </span>
          <span className="font-bold text-indigo-700 dark:text-indigo-300">
            ₹{currentBench.medianWage}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
          <span className="text-slate-400 block text-[10px]">75th Percentile</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            ₹{currentBench.p75Wage}
          </span>
        </div>
      </div>

      {onSelectSuggestedRate && (
        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">
            Recommended Daily Pay: <strong className="text-slate-900 dark:text-white">₹{currentBench.suggestedDailyRate}</strong>
          </span>
          <button
            type="button"
            onClick={() => onSelectSuggestedRate(currentBench.suggestedDailyRate)}
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            Apply Suggested Rate
          </button>
        </div>
      )}
    </div>
  );
};
