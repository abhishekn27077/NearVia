/**
 * NEARVIA Formatters Utility (Admin)
 */

export function formatDateTimeHuman(isoString?: string | null): string {
  if (!isoString) return "Flexible schedule";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function formatCurrencyINR(amount?: number | string | null): string {
  if (amount === undefined || amount === null || amount === "") return "₹0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹0";
  return `₹${num.toLocaleString("en-IN")}`;
}
