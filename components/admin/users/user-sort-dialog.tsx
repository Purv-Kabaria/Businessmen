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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortField = "createdAt" | "updatedAt" | "email" | "fullName" | "role";
type SortOrder = "asc" | "desc";

const sortFields: { value: SortField; label: string }[] = [
  { value: "fullName", label: "Full Name" },
  { value: "email", label: "Email" },
  { value: "role", label: "Role" },
  { value: "createdAt", label: "Created date" },
  { value: "updatedAt", label: "Updated date" },
];

const sortOrders: { value: SortOrder; label: string }[] = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

export interface AdminUserSort {
  field: SortField;
  order: SortOrder;
}

interface AdminUserSortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSort?: AdminUserSort | null;
  onApply: (sort: AdminUserSort) => void;
  onClear: () => void;
}

export function AdminUserSortDialog({
  open,
  onOpenChange,
  initialSort,
  onApply,
  onClear,
}: AdminUserSortDialogProps) {
  const [field, setField] = useState<SortField>("fullName");
  const [order, setOrder] = useState<SortOrder>("desc");

  const initialState = useMemo<AdminUserSort>(() => {
    return (
      initialSort ?? {
        field: "fullName",
        order: "desc",
      }
    );
  }, [initialSort]);

  useEffect(() => {
    if (open) {
      setField(initialState.field);
      setOrder(initialState.order);
    }
  }, [initialState.field, initialState.order, open]);

  const handleApply = () => {
    onApply({ field, order });
  };

  const handleClear = () => {
    setField("fullName");
    setOrder("desc");
    onClear();
    onOpenChange(false);
  };

  const currentField = sortFields.find((option) => option.value === initialState.field);
  const currentOrder = sortOrders.find((option) => option.value === initialState.order);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sort Users</DialogTitle>
          <DialogDescription>
            Choose a field and direction to reorder the user list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Current selection
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {currentField?.label ?? "Full Name"}
              </span>
              <Badge variant="outline" className="uppercase tracking-wide">
                {currentOrder?.label ?? "Descending"}
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground/80">
              Adjust the options below to update how the table is ordered.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Sort by</p>
              <Select
                value={field}
                onValueChange={(value: SortField) => setField(value)}>
                <SelectTrigger className="w-full cursor-pointer">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent className="w-[--radix-select-trigger-width]">
                  {sortFields.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="cursor-pointer">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Order</p>
              <Select
                value={order}
                onValueChange={(value: SortOrder) => setOrder(value)}>
                <SelectTrigger className="w-full cursor-pointer">
                  <SelectValue placeholder="Select order" />
                </SelectTrigger>
                <SelectContent className="w-[--radix-select-trigger-width]">
                  {sortOrders.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="cursor-pointer">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={handleClear} className="cursor-pointer">
            Clear sort
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


