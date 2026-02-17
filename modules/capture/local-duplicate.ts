import { getAllContacts } from "./db";
import { normalizeEmail, phoneLast10 } from "./utils";

async function duplicateInIndexedDB(phone: string, email: string | undefined): Promise<boolean> {
  const contacts = await getAllContacts();
  const inputLast10 = phone.trim() ? phoneLast10(phone) : null;
  const normEmail = email?.trim() ? normalizeEmail(email) : null;
  return contacts.some((c) => {
    if (inputLast10 && phoneLast10(c.phone) === inputLast10) return true;
    if (normEmail && c.email && normalizeEmail(c.email) === normEmail) return true;
    return false;
  });
}

async function duplicateInDatabase(phone: string, email: string | undefined): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  try {
    const res = await fetch("/api/contacts/check-duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, email: email ?? "" }),
    });
    const json = await res.json();
    return json?.data?.exists === true;
  } catch {
    return false;
  }
}

export async function hasLocalDuplicate(phone: string, email: string | undefined): Promise<boolean> {
  const [inIndexedDB, inDb] = await Promise.all([
    duplicateInIndexedDB(phone, email),
    duplicateInDatabase(phone, email),
  ]);
  return inIndexedDB || inDb;
}
