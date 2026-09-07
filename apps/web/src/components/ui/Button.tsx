import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  "inline-flex items-center justify-center font-bold transition-transform duration-100 ease-out select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.96] cursor-pointer touch-target",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]",
        primary:
          "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)]",
        tangerine:
          "bg-orange-600 hover:bg-orange-700 text-white shadow-md hover:shadow-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)]",
        amber:
          "bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]",
        charcoal:
          "bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]",
        emerald:
          "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]",
        outline:
          "border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 shadow-xs",
        glass:
          "bg-white/80 backdrop-blur-xl border border-white/60 hover:bg-white text-slate-900 shadow-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]",
        ghost:
          "hover:bg-slate-100 text-slate-700 hover:text-slate-900",
        danger:
          "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]",
      },
      size: {
        sm: "text-xs px-3.5 py-2 rounded-xl gap-1.5 min-h-[40px]",
        md: "text-xs sm:text-sm px-4.5 py-2.5 rounded-xl gap-2 min-h-[44px]",
        lg: "text-sm sm:text-base px-6 py-3 rounded-2xl gap-2.5 min-h-[48px]",
        icon: "p-2.5 rounded-xl min-w-[44px] min-h-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
