import { describe, expect, it } from "vitest";
import { numberToWordsIndian } from "@/lib/numwords";
import {
  daysBetween,
  formatCertificate,
  formatINR,
  formatReference,
  initials,
  safeJson,
} from "@/lib/utils";

describe("formatReference", () => {
  it("formats SF/INC/year/sequence", () => {
    expect(formatReference(7, 2026)).toBe("SF/INC/2026/000007");
    expect(formatReference(123, 2025)).toBe("SF/INC/2025/000123");
  });
});

describe("formatCertificate", () => {
  it("builds district-scoped certificate numbers", () => {
    const c = formatCertificate("Ramanagara", 4);
    expect(c).toMatch(/^IC\/RAM\/\d{4}\/\d{6}$/);
  });
});

describe("safeJson", () => {
  it("parses valid JSON and falls back otherwise", () => {
    expect(safeJson('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeJson("not-json", { x: 2 })).toEqual({ x: 2 });
    expect(safeJson(null, [])).toEqual([]);
  });
});

describe("formatINR", () => {
  it("formats Indian grouping", () => {
    expect(formatINR(120000)).toContain("1,20,000");
    expect(formatINR(null)).toBe("—");
  });
});

describe("numberToWordsIndian", () => {
  it("handles Indian place values", () => {
    expect(numberToWordsIndian(120000)).toMatch(/one lakh/i);
    expect(numberToWordsIndian(0)).toMatch(/zero/i);
    expect(numberToWordsIndian(152)).toMatch(/one hundred fifty two/i);
    const lakhCrore = numberToWordsIndian(12345678);
    expect(lakhCrore).toMatch(/crore/i);
    expect(lakhCrore).toMatch(/lakh/i);
  });
});

describe("daysBetween", () => {
  it("computes whole days", () => {
    const a = new Date("2026-01-01");
    const b = new Date("2026-01-10");
    expect(daysBetween(a, b)).toBe(9);
  });
});

describe("initials", () => {
  it("takes first letters of two words", () => {
    expect(initials("Suma R")).toBe("SR");
    expect(initials("Kiran")).toBe("K");
  });
});
