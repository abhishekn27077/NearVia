import React, { ReactNode } from "react";
import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  actionIcon?: LucideIcon;
  extra?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  actionIcon: ActionIcon,
  extra,
}) => {
  return (
    <div
      role="region"
      aria-label={title}
      className="p-8 sm:p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800/80 space-y-4 max-w-lg mx-auto my-6"
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center border border-slate-700/60 shadow-inner">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">{description}</p>
      </div>

      {(actionLabel && (onAction || actionHref)) && (
        <div className="pt-2">
          {actionHref ? (
            <a
              href={actionHref}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition shadow-sm"
            >
              {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
              <span>{actionLabel}</span>
            </a>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition shadow-sm"
            >
              {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
              <span>{actionLabel}</span>
            </button>
          )}
        </div>
      )}

      {extra && <div className="pt-2">{extra}</div>}
    </div>
  );
};
