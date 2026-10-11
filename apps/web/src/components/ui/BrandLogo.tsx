import React from "react";

export interface BrandLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Logo display variant:
   * - "full": Complete horizontal logo with "N" symbol and "NEARVIA" wordmark
   * - "symbol": Standalone "N" / location pin symbol
   */
  variant?: "full" | "symbol";
  /**
   * Theme mode:
   * - "light": Dark navy wordmark for white / light neutral surfaces
   * - "dark": High-contrast white wordmark for navy / dark neutral / dark-mode surfaces
   * - "auto": Responsive to dark-mode context via picture elements
   */
  theme?: "light" | "dark" | "auto";
  /**
   * Pre-configured optical sizing tokens:
   * - "xs": Compact headers, tags, micro-badges (~20-22px height)
   * - "sm": Standard mobile header, drawer items (~28px height)
   * - "md": Desktop navbar, card headers (~36px height)
   * - "lg": Auth cards, modal banners (~48px height)
   * - "xl": Splash screens, marketing heroes (~64px height)
   * - "custom": Size completely dictated by className
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  /**
   * Additional Tailwind or CSS classes
   */
  className?: string;
  /**
   * Accessible alternative text
   */
  alt?: string;
  /**
   * Whether this logo is above-the-fold / primary brand element
   */
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
  const defaultAlt = isSymbol ? "NEARVIA" : "NEARVIA — Work Within Reach";
  const accessibleAlt = alt ?? defaultAlt;

  const sizeClasses = isSymbol
    ? SYMBOL_SIZE_CLASSES[size]
    : FULL_SIZE_CLASSES[size];

  // Standalone Symbol
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

  // Full Wordmark — Explicit Dark Theme
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

  // Full Wordmark — Explicit Light Theme
  if (theme === "light") {
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
  }

  // Full Wordmark — Auto Theme (Adapts to dark mode with picture tags)
  return (
    <picture className={`inline-flex shrink-0 ${sizeClasses} ${className}`}>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet="/brand/nearvia-logo-dark.png"
      />
      <img
        src="/brand/nearvia-logo.png"
        alt={accessibleAlt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`w-full h-full object-contain shrink-0 select-none`}
        {...rest}
      />
    </picture>
  );
};
