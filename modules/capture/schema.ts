import { z } from "zod";
import { STALL_INTENTS } from "./constants";
import { normalizePhone } from "./utils";

const phoneRegex = /^[\d\s+\-()]{10,15}$/;

export const stallLeadSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Name cannot be only spaces"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .regex(phoneRegex, "Enter a valid phone number")
    .transform(normalizePhone),
  email: z
    .string()
    .optional()
    .transform((s) => (s === undefined || s === "" ? undefined : s.trim().toLowerCase()))
    .refine((s) => s === undefined || s === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "Invalid email")
    .optional(),
  intent_tags: z.array(z.enum(STALL_INTENTS)).min(1, "Select at least one interest"),
});

export type StallLeadFormValues = z.infer<typeof stallLeadSchema>;
