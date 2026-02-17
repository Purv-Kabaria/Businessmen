"use client";

import { ColumnDef } from "@tanstack/react-table";
import { User } from "@/types/user";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const getColumns = (
  openViewDialog: (user: User) => void,
  openEditDialog: (user: User) => void,
  openDeleteDialog: (user: User) => void
): ColumnDef<User>[] => [
    {
      accessorKey: "fullName",
      header: "Full Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.getValue<string>("role");
        return (
          <Badge variant="outline" className="uppercase tracking-wide">
            {role.toLowerCase()}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem className="cursor-pointer" onClick={() => openViewDialog(user)}>
                View User
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => openEditDialog(user)}>
                Edit User
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openDeleteDialog(user)}
                className="text-red-600 cursor-pointer">
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
