/**
 * String and currency formatting utilities
 */

/**
 * Formats a localized currency amount
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = "INR",
  locale: string = "en-IN",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats distance in kilometers or meters for human-friendly mobile/web display.
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Sanitizes phone numbers by stripping whitespace and non-digit characters except leading plus.
 */
export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}
