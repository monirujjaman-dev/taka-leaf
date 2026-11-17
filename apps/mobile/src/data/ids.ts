/**
 * Guid v7 ids, made on the phone for new rows (the server accepts client ids). The first 48 bits
 * are the time in milliseconds, so ids sort roughly by creation, as the server's do.
 */
function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  const crypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (crypto?.getRandomValues) return crypto.getRandomValues(bytes);
  for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

export function newId(now: Date = new Date()): string {
  const bytes = randomBytes(16);
  let time = now.getTime();
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = 0x70 | (bytes[6]! & 0x0f);
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
