import { format, isBefore, parseISO, subDays } from "date-fns";

export type HabitWithMeta = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  created_at: string;
  completed: boolean;
  streak: number;
};

export function computeStreak(completionDates: string[], referenceDate: string): number {
  const sorted = [...completionDates].sort().reverse();
  if (sorted.length === 0) return 0;

  const ref = parseISO(referenceDate);
  const mostRecent = parseISO(sorted[0]);

  // Streak is broken if the most recent completion is before yesterday.
  if (isBefore(mostRecent, subDays(ref, 1))) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]);
    const curr = parseISO(sorted[i]);
    if (format(subDays(prev, 1), "yyyy-MM-dd") === format(curr, "yyyy-MM-dd")) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function computeLongestStreak(completionDates: string[]): number {
  if (completionDates.length === 0) return 0;
  const sorted = [...completionDates].sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]);
    const curr = parseISO(sorted[i]);
    if (format(subDays(curr, 1), "yyyy-MM-dd") === format(prev, "yyyy-MM-dd")) {
      current++;
      longest = Math.max(longest, current);
    } else if (format(prev, "yyyy-MM-dd") !== format(curr, "yyyy-MM-dd")) {
      current = 1;
    }
  }

  return longest;
}

export function computeConsistencyRate(completionDates: string[], startDate: string, endDate: string): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (isBefore(end, start)) return 0;

  let totalDays = 0;
  let completedDays = 0;
  const completedSet = new Set(completionDates);

  for (let d = new Date(start.getTime()); !isBefore(end, d); d = subDays(d, -1)) {
    const key = format(d, "yyyy-MM-dd");
    totalDays++;
    if (completedSet.has(key)) completedDays++;
  }

  if (totalDays === 0) return 0;
  return Math.round((completedDays / totalDays) * 100);
}
