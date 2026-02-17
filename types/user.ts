import { z } from "zod";

export const UserRole = z.enum(["USER", "MODERATOR", "ADMIN"]);

// Reusable atomic schemas
const emailSchema = z
  .string()
  .email("Please enter a valid email address.")
  .max(255, "Email address is too long.");

const fullNameSchema = z
  .string()
  .min(2, "Full name must be at least 2 characters.")
  .max(100, "Full name is too long.");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(100, "Password is too long.")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/,
    "Password must be 8+ chars, with 1 uppercase, 1 lowercase, 1 number, and 1 special symbol."
  );

// Main schemas
export const userSchema = z.object({
  id: z.string(),
  email: emailSchema,
  fullName: fullNameSchema,
  role: UserRole,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const signupSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    role: UserRole.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(100, "Password is too long."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    token: z.string().min(1, "Reset token is required.").max(512),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export interface UserJwtPayload {
  id: string;
  email: string;
  role: z.infer<typeof UserRole>;
  fullName: string;
}
