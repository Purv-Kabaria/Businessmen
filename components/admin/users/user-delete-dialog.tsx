"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User } from "@/types/user";

interface AdminUserDeleteDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (userId: string) => void;
}

export function AdminUserDeleteDialog({
  user,
  open,
  onOpenChange,
  onDeleted,
}: AdminUserDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsDeleting(false);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error?.message || "Failed to delete user.");
        return;
      }

      toast.success("User deleted successfully.");
      onDeleted(user.id);
      onOpenChange(false);
    } catch (error) {
      console.error("[AdminUserDeleteDialog] Deletion failed", error);
      toast.error("An unexpected error occurred while deleting the user.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            This action will permanently remove the selected user and cannot be
            undone.
          </AlertDialogDescription>
          {user ? (
            <p className="text-sm text-muted-foreground">
              Selected: {user.fullName} ({user.email})
            </p>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
