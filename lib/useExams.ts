import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getDeadlines } from "@/lib/deadlines.functions";
import { toExams } from "@/lib/exams";

/** All exams (upcoming and past). Shares its cache with the University page's deadlines. */
export function useExams() {
  const fetchDeadlines = useServerFn(getDeadlines);
  const { data = [], isPending } = useQuery({ queryKey: ["deadlines"], queryFn: () => fetchDeadlines() });
  const all = toExams(data);
  return { all, upcoming: all.filter((e) => e.daysLeft >= 0), past: all.filter((e) => e.daysLeft < 0), isPending };
}
