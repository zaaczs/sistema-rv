export const PHONE_MAX_DIGITS = 11;
export const PHONE_MIN_DIGITS = 10;

export function normalizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? digits.slice(0, PHONE_MAX_DIGITS) : null;
}

export function validatePhone(phone?: string | null): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return `Telefone deve ter entre ${PHONE_MIN_DIGITS} e ${PHONE_MAX_DIGITS} dígitos`;
  }
  return null;
}
