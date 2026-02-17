"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  Updater,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Search } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
  onSortChange: (updater: Updater<SortingState>) => void;
  onFilterChange: (filter: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  children?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  onPageChange,
  onSortChange,
  onFilterChange,
  onRefresh,
  isLoading,
  pageIndex,
  pageSize,
  sorting,
  children,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount,
    onSortingChange: onSortChange,
    state: {
      sorting,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                onChange={(event) => onFilterChange(event.target.value)}
                className="w-full border-border/60 bg-background pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-10 gap-2 border-border/60">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
          {children}
        </div>
        <Table>
          <TableHeader className="bg-muted/20">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-muted/30">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-12 px-6 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="bg-card hover:bg-muted/20">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-6 py-4 text-sm text-foreground/85">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 py-4">
        <span className="text-sm text-muted-foreground text-center">
          Page {pageIndex + 1} of {pageCount > 0 ? pageCount : 1}
        </span>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={pageIndex === 0}
            className="cursor-pointer">
            Previous
          </Button>

          {(() => {
            const maxVisiblePages = 5;
            let startPage = Math.max(0, pageIndex - 2);
            const endPage = Math.min(pageCount, startPage + maxVisiblePages);

            if (endPage - startPage < maxVisiblePages) {
              startPage = Math.max(0, endPage - maxVisiblePages);
            }

            const pages = [];
            for (let i = startPage; i < endPage; i++) {
              pages.push(i);
            }

            return pages.map((page) => (
              <Button
                key={page}
                variant={page === pageIndex ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={`w-9 h-9 p-0 cursor-pointer ${page === pageIndex ? "pointer-events-none" : ""}`}>
                {page + 1}
              </Button>
            ));
          })()}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={pageIndex + 1 >= pageCount}
            className="cursor-pointer">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
