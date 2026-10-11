import React from "react";

export interface BrandLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: "full" | "symbol";
  theme?: "light" | "dark" | "auto";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  className?: string;
  alt?: string;
  priority?: boolean;
}

const FULL_SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  xs: "h-5 w-auto max-w-[130px]",
  sm: "h-7 w-auto max-w-[170px]",
  md: "h-9 w-auto max-w-[210px]",
  lg: "h-12 w-auto max-w-[280px]",
  xl: "h-16 w-auto max-w-[360px]",
  custom: "",
};

const SYMBOL_SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
  custom: "",
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = "full",
  theme = "light",
  size = "md",
  className = "",
  alt,
  priority = false,
  ...rest
}) => {
  const isSymbol = variant === "symbol";
  const defaultAlt = isSymbol ? "NEARVIA" : "NEARVIA Admin";
  const accessibleAlt = alt ?? defaultAlt;

  const sizeClasses = isSymbol
    ? SYMBOL_SIZE_CLASSES[size]
    : FULL_SIZE_CLASSES[size];

  if (isSymbol) {
    return (
      <img
        src="/brand/nearvia-symbol.png"
        alt={accessibleAlt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`object-contain shrink-0 transition-opacity select-none ${sizeClasses} ${className}`}
        {...rest}
      />
    );
  }

  if (theme === "dark") {
    return (
      <img
        src="/brand/nearvia-logo-dark.png"
        alt={accessibleAlt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`object-contain shrink-0 transition-opacity select-none ${sizeClasses} ${className}`}
        {...rest}
      />
    );
  }

  return (
    <img
      src="/brand/nearvia-logo.png"
      alt={accessibleAlt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`object-contain shrink-0 transition-opacity select-none ${sizeClasses} ${className}`}
      {...rest}
    />
  );
};
