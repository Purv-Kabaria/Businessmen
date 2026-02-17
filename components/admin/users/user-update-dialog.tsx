"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { User } from "@/types/user";
import { UserRole } from "@/types/user";

const adminUpdateSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name is too long.")
    .optional(),
  email: z
    .string()
    .email("Please enter a valid email address.")
    .max(255, "Email address is too long.")
    .optional(),
  role: UserRole.optional(),
  newPassword: z.string().optional().or(z.literal("")),
});

type AdminUpdateFormValues = z.infer<typeof adminUpdateSchema>;

const roleOptions = UserRole.options;

interface AdminUserUpdateDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (user: User) => void;
}

export function AdminUserUpdateDialog({
  user,
  open,
  onOpenChange,
  onUpdated,
}: AdminUserUpdateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultValues = useMemo<AdminUpdateFormValues>(
    () => ({
      fullName: user?.fullName ?? "",
      email: user?.email ?? "",
      role: user?.role,
    }),
    [user]
  );

  const form = useForm<AdminUpdateFormValues>({
    resolver: zodResolver(adminUpdateSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [defaultValues, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!user) return;

    const payload: Record<string, unknown> = { userId: user.id };

    const trimmedFullName = values.fullName?.trim() ?? "";
    const trimmedEmail = values.email?.trim() ?? "";

    if (trimmedFullName && trimmedFullName !== user.fullName) {
      payload.fullName = trimmedFullName;
    }

    if (trimmedEmail && trimmedEmail !== user.email) {
      payload.email = trimmedEmail.toLowerCase();
    }

    if (values.role && values.role !== user.role) {
      payload.role = values.role;
    }

    if (values.newPassword && values.newPassword.trim() !== "") {
      payload.newPassword = values.newPassword;
    }

    const hasUpdates = Object.keys(payload).length > 1;
    if (!hasUpdates) {
      toast.info("No changes detected for this user.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/user/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error?.message || "Failed to update user.");
        return;
      }

      toast.success("User updated successfully.");
      onUpdated(result.data as User);
      onOpenChange(false);
    } catch (error) {
      console.error("[AdminUserUpdateDialog] Update failed", error);
      toast.error("An unexpected error occurred while updating the user.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update User</DialogTitle>
          <DialogDescription>
            Modify profile details or role assignments for the selected user.
          </DialogDescription>
        </DialogHeader>
        {user ? (
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
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Select a role" />
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
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        {...field}
                        placeholder="Set new password"
                        autoComplete="new-password"
                      />
                    </FormControl>
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
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
