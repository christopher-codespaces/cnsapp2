import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : null;
}

/** Format a price in cents as a display string (0 -> "Free"). */
export function formatPrice(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Parse a dollar input ("19.99") into cents. NaN-safe. */
export function dollarsToCents(dollars: string): number {
  const n = Number.parseFloat(dollars);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Format cents as a dollar input value ("19.99"). */
export function centsToDollars(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}