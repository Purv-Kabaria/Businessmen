import { prisma } from "@/lib/prisma";
import { phoneLast10 } from "@/modules/capture/utils";

export type ContactByLast10 = { id: string; phone: string } | null;

export async function findContactByPhoneLast10(inputPhone: string): Promise<ContactByLast10> {
  const last10 = phoneLast10(inputPhone);
  if (last10.length < 10) return null;
  const rows = await prisma.$queryRaw<{ id: string; phone: string }[]>`
    SELECT id, phone FROM contacts
    WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = ${last10}
    LIMIT 1
  `;
  return rows[0] ?? null;
}
