import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatEmploymentType(value: string | null | undefined): string {
  const map: Record<string, string> = {
    full_time: "Full time",
    part_time: "Part time",
    contract: "Contract",
  };
  return value ? (map[value] ?? value) : "";
}