export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    return digits.slice(0, 12);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function phoneLast10(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
