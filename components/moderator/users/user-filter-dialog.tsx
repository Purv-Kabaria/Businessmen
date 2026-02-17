"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ModeratorUserFilters { }

interface ModeratorUserFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilters: ModeratorUserFilters;
  onApply: (filters: ModeratorUserFilters) => void;
  onClear: () => void;
}

export function ModeratorUserFilterDialog({
  open,
  onOpenChange,
  initialFilters,
  onApply,
  onClear,
}: ModeratorUserFilterDialogProps) {
  const handleApply = () => {
    onApply({});
  };

  const handleClear = () => {
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
          <p className="text-sm text-muted-foreground">
            No additional filters available. All users shown are regular users.
          </p>
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
