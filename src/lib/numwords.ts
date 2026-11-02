/** Number → words, Indian numbering system (lakh / crore). English only. */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

function threeDigit(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? ONES[h] + " Hundred" + (rest ? " " : "") : ""}${rest ? twoDigit(rest) : ""}`.trim();
}

export function numberToWordsIndian(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigit(crore)} Crore`);
  if (lakh) parts.push(`${threeDigit(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigit(thousand)} Thousand`);
  if (rest) parts.push(threeDigit(rest));
  return parts.join(" ");
}
