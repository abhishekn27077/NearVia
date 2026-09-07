/**
 * NEARVIA Formatters Utility
 * Humanizes dates, times, durations, distances, and currency amounts across the platform.
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

export function formatDateLabel(dateStr?: string | null): string {
  if (!dateStr) return "Upcoming";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return dateStr;

    const today = new Date();
    const isToday =
      d.getUTCDate() === today.getUTCDate() &&
      d.getUTCMonth() === today.getUTCMonth() &&
      d.getUTCFullYear() === today.getUTCFullYear();

    const tomorrow = new Date();
    tomorrow.setUTCDate(today.getUTCDate() + 1);
    const isTomorrow =
      d.getUTCDate() === tomorrow.getUTCDate() &&
      d.getUTCMonth() === tomorrow.getUTCMonth() &&
      d.getUTCFullYear() === tomorrow.getUTCFullYear();

    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";

    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

export function formatTimeLabel(timeStr?: string | null): string {
  if (!timeStr) return "";
  try {
    if (timeStr.includes("T")) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }
    }

    // HH:MM or HH:MM:SS format
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
      const hour = parseInt(parts[0] || "0", 10);
      const minute = parseInt(parts[1] || "0", 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const h12 = hour % 12 || 12;
      const minStr = minute < 10 ? `0${minute}` : minute;
      return `${h12}:${minStr} ${ampm}`;
    }

    return timeStr;
  } catch {
    return timeStr;
  }
}

export function formatScheduleRange(
  workDate?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  durationHours?: number | null,
): string {
  const dLabel = formatDateLabel(workDate);
  const sLabel = formatTimeLabel(startTime);
  const eLabel = formatTimeLabel(endTime);
  const durLabel = durationHours ? ` (${durationHours}h)` : "";

  if (sLabel && eLabel) {
    return `${dLabel}, ${sLabel} – ${eLabel}${durLabel}`;
  }
  if (sLabel) {
    return `${dLabel} at ${sLabel}${durLabel}`;
  }
  return `${dLabel}${durLabel}`;
}

export function formatCurrencyINR(amount?: number | string | null): string {
  if (amount === undefined || amount === null || amount === "") return "₹0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹0";
  return `₹${num.toLocaleString("en-IN")}`;
}

export function formatDistanceKm(distanceKm?: number | null): string {
  if (distanceKm === undefined || distanceKm === null) return "Nearby";
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}
