import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic reference number: SF/INC/YYYY/NNNNNN */
export function formatReference(seq: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `SF/INC/${y}/${String(seq).padStart(6, "0")}`;
}

/** Certificate number issued on approval: IC/<DIST>/<YYYY>/<NNNNNN> */
export function formatCertificate(district: string, seq: number): string {
  const d = district.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "KA";
  return `IC/${d}/${new Date().getFullYear()}/${String(seq).padStart(6, "0")}`;
}

export function daysBetween(a: Date, b: Date = new Date()): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(d: Date | string | null | undefined, lang = "en"): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(lang === "kn" ? "kn-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined, lang = "en"): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(lang === "kn" ? "kn-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatINR(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Deterministic seeded PRNG (mulberry32) for reproducible demo data. */
export function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
