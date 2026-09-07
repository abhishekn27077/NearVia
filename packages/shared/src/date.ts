/**
 * Date and time helper utilities for NEARVIA
 */

/**
 * Calculates duration in hours between two ISO date strings.
 */
export function calculateDurationHours(
  startTimeIso: string,
  endTimeIso: string,
): number {
  const start = new Date(startTimeIso).getTime();
  const end = new Date(endTimeIso).getTime();

  if (isNaN(start) || isNaN(end) || end <= start) {
    return 0;
  }

  const diffMs = end - start;
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 10) / 10;
}

/**
 * Checks if a target time window overlaps with a worker's availability window.
 */
export function isTimeWindowOverlapping(
  slot1Start: string,
  slot1End: string,
  slot2Start: string,
  slot2End: string,
): boolean {
  const s1 = new Date(slot1Start).getTime();
  const e1 = new Date(slot1End).getTime();
  const s2 = new Date(slot2Start).getTime();
  const e2 = new Date(slot2End).getTime();

  return Math.max(s1, s2) < Math.min(e1, e2);
}
