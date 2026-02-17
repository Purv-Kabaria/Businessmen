"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserRole } from "@/types/user";
import type { User } from "@/types/user";

const adminCreateSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters.")
      .max(100, "Full name is too long."),
    email: z
      .string()
      .email("Please enter a valid email address.")
      .max(255, "Email address is too long."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(100, "Password is too long.")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/,
        "Password must be 8+ chars, with 1 uppercase, 1 lowercase, 1 number, and 1 special symbol."
      ),
    confirmPassword: z.string(),
    role: UserRole.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type AdminCreateFormValues = z.infer<typeof adminCreateSchema>;

const roleOptions = UserRole.options;

interface AdminUserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: User) => void;
}

export function AdminUserCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: AdminUserCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AdminCreateFormValues>({
    resolver: zodResolver(adminCreateSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: undefined,
      });
    }
  }, [form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/user/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          email: values.email.toLowerCase().trim(),
          password: values.password,
          confirmPassword: values.confirmPassword,
          role: values.role,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error?.message || "Failed to create user.");
        return;
      }

      toast.success("User created successfully.");
      onCreated(result.data as User);
      onOpenChange(false);
    } catch (error) {
      console.error("[AdminUserCreateDialog] Creation failed", error);
      toast.error("An unexpected error occurred while creating the user.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Create a new user account with the specified details and role.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Jane Doe" maxLength={100} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      placeholder="jane@example.com"
                      maxLength={255}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      maxLength={100}
                      {...field}
                      placeholder="••••••••"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      maxLength={100}
                      {...field}
                      placeholder="••••••••"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Select a role (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="w-[--radix-select-trigger-width]">
                      {roleOptions.map((role) => (
                        <SelectItem key={role} value={role} className="cursor-pointer">
                          {role.charAt(0) + role.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

