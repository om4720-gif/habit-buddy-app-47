import { useCallback, useEffect, useState } from "react";

export type ReminderItem = {
  id: string;
  title: string;
  kind: string;
  due_date: string;
  completed: boolean;
  courseName?: string | null;
};

export type PermissionState =
  | "unsupported"
  | "open-in-new-tab"
  | "default"
  | "granted"
  | "denied";

const STORAGE_KEY = "ritual:notified-deadlines";

function readNotified(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markNotified(key: string) {
  const list = readNotified();
  if (!list.includes(key)) {
    list.push(key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-200)));
  }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}


export function useDeadlineReminders(items: ReminderItem[]) {
  const [permission, setPermission] = useState<PermissionState>("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    if (window.top !== window.self) {
      setPermission("open-in-new-tab");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;

    function check() {
      const today = todayISO();
      for (const item of items) {
        if (item.completed || item.due_date !== reminderDate(item.kind)) continue;
        const key = `${item.id}:${today}`;
        if (readNotified().includes(key)) continue;
        const heading =
          item.kind === "quiz" ? "Quiz in 2 days" : "Assignment due tomorrow";
        new Notification(heading, {
          body: item.courseName
            ? `${item.title} — ${item.courseName}`
            : item.title,
          tag: key,
        });
        markNotified(key);
      }
    }

    check();
    const timer = window.setInterval(check, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [items, permission]);

  const dueSoon = items.filter(
    (i) => !i.completed && i.due_date === reminderDate(i.kind)
  );

  return { permission, requestPermission, dueSoon };
}

function reminderDate(kind: string) {
  const d = new Date();
  d.setDate(d.getDate() + (kind === "quiz" ? 2 : 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
