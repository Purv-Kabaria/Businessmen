"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserRole } from "@/types/user";

type RoleOption = "ALL" | (typeof UserRole.options)[number];

export interface AdminUserFilters {
  role?: (typeof UserRole.options)[number];
}

interface AdminUserFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilters: AdminUserFilters;
  onApply: (filters: AdminUserFilters) => void;
  onClear: () => void;
}

const roleOptions: RoleOption[] = ["ALL", ...UserRole.options];

export function AdminUserFilterDialog({
  open,
  onOpenChange,
  initialFilters,
  onApply,
  onClear,
}: AdminUserFilterDialogProps) {
  const [selectedRole, setSelectedRole] = useState<RoleOption>("ALL");

  const initialRole = useMemo<RoleOption>(() => {
    return initialFilters.role ?? "ALL";
  }, [initialFilters.role]);

  useEffect(() => {
    if (open) {
      setSelectedRole(initialRole);
    }
  }, [initialRole, open]);

  const handleApply = () => {
    onApply({
      role: selectedRole === "ALL" ? undefined : selectedRole,
    });
  };

  const handleClear = () => {
    setSelectedRole("ALL");
    onClear();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter Users</DialogTitle>
          <DialogDescription>
            Refine the user list by selecting one or more criteria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Role</p>
            <Select
              value={selectedRole}
              onValueChange={(value: RoleOption) => setSelectedRole(value)}>
              <SelectTrigger className="w-full cursor-pointer">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent className="w-[--radix-select-trigger-width]">
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role} className="cursor-pointer">
                    {role === "ALL"
                      ? "All roles"
                      : role.charAt(0) + role.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={handleClear} className="cursor-pointer">
            Clear filters
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleApply} className="cursor-pointer">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

