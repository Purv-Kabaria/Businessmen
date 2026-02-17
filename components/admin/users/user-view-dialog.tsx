"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { User } from "@/types/user";
import { Eye } from "lucide-react";

interface AdminUserViewDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminUserViewDialog({
  user,
  open,
  onOpenChange,
}: AdminUserViewDialogProps) {
  if (!user) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto [&>button[data-slot='dialog-close']]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            User Details
          </DialogTitle>
          <DialogDescription>
            Complete information for the selected user account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                User ID
              </p>
              <p className="text-sm font-mono text-foreground break-all">
                {user.id}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Full Name
              </p>
              <p className="text-base text-foreground">{user.fullName}</p>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Email Address
              </p>
              <p className="text-base text-foreground break-all">
                {user.email}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Role
              </p>
              <Badge variant="outline" className="uppercase tracking-wide">
                {user.role.toLowerCase()}
              </Badge>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Account Created
              </p>
              <p className="text-sm text-foreground">
                {formatDate(user.createdAt)}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Last Updated
              </p>
              <p className="text-sm text-foreground">
                {formatDate(user.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
