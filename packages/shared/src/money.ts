/**
 * Money in TakaLeaf is always a whole number of poisha (1 taka = 100 poisha).
 * Never store or add amounts as decimals.
 */

const MINUS = "−";
const TAKA = "৳";

/** Groups digits the Bangladeshi way: last three, then pairs (1,25,000). */
function groupBangladeshi(digits: string): string {
  if (digits.length <= 3) return digits;
  const tail = digits.slice(-3);
  let head = digits.slice(0, -3);
  const parts: string[] = [];
  while (head.length > 2) {
    parts.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  if (head.length > 0) parts.unshift(head);
  return `${parts.join(",")},${tail}`;
}

/** Formats poisha as taka, for example 12500000 -> "৳1,25,000.00". */
export function formatBdt(poisha: number): string {
  if (!Number.isSafeInteger(poisha)) {
    throw new RangeError("Amount must be a whole number of poisha");
  }
  const abs = Math.abs(poisha);
  const taka = Math.floor(abs / 100).toString();
  const rest = (abs % 100).toString().padStart(2, "0");
  const sign = poisha < 0 ? MINUS : "";
  return `${sign}${TAKA}${groupBangladeshi(taka)}.${rest}`;
}

/**
 * Parses what a person types ("1250", "1,250.5", "1250.50") into poisha.
 * Returns null when the text is not a valid amount with at most two decimals.
 */
export function parseTaka(text: string): number | null {
  const cleaned = text.replace(/[\s,৳]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  const poisha = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(poisha) ? poisha : null;
}
