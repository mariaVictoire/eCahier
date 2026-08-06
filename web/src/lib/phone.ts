/** Digits only, international format for wa.me (no +). */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Normalize Gabon-friendly numbers to WhatsApp international digits. */
export function normalizePhoneForWhatsApp(phone: string): string | null {
  let digits = phoneDigits(phone);
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 8) {
    return `241${digits.slice(1)}`;
  }
  if (digits.startsWith("241")) return digits;
  if (digits.length <= 9) return `241${digits}`;
  return digits;
}

export function whatsappUrl(phone: string, message: string): string | null {
  const intl = normalizePhoneForWhatsApp(phone);
  if (!intl) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

export function teacherAccountWhatsAppMessage(opts: {
  firstName: string;
  lastName: string;
  pin: string;
  schoolName?: string | null;
}): string {
  const school = opts.schoolName ? ` pour ${opts.schoolName}` : "";
  return [
    `Bonjour ${opts.firstName} ${opts.lastName},`,
    ``,
    `Votre compte enseignant eCahier a été créé${school}.`,
    `Votre code PIN : ${opts.pin}`,
    ``,
    `Pour remplir le cahier de textes : scannez le QR de la salle, puis saisissez ce PIN.`,
    `Conservez ce code confidentiel.`,
  ].join("\n");
}
