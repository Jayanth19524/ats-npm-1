export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  employee: "Employee",
};

export const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  linkedin: "LinkedIn",
  referral: "Referral",
  agency: "Agency",
  other: "Other",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  on_hold: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  closed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  submitted: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  reviewing: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  interviewing: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  hired: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};
