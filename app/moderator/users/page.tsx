"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SortingState, Updater } from "@tanstack/react-table";
import { toast } from "sonner";

import { getColumns } from "@/components/admin/users/columns";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { User, UserRole } from "@/types/user";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { AdminUserUpdateDialog } from "@/components/admin/users/user-update-dialog";
import { AdminUserDeleteDialog } from "@/components/admin/users/user-delete-dialog";
import { AdminUserViewDialog } from "@/components/admin/users/user-view-dialog";
import {
  ModeratorUserFilterDialog,
  ModeratorUserFilters,
} from "@/components/moderator/users/user-filter-dialog";
import {
  ModeratorUserSortDialog,
  ModeratorUserSort,
} from "@/components/moderator/users/user-sort-dialog";
import { FilterIcon, SortDescIcon } from "lucide-react";
import { UserStats } from "@/components/admin/users/user-stats";
import { UserGrowthChart } from "@/components/admin/users/user-growth-chart";

type UserListPagination = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type UserListResponse = {
  users: User[];
  pagination: UserListPagination;
};

const PAGE_SIZE = 10;

function resolveSortField(columnId: string | undefined): string {
  switch (columnId) {
    case "fullName":
    case "email":
      return columnId;
    default:
      return "createdAt";
  }
}

function ModeratorUsersPageFallback() {
  return (
    <main className="min-h-screen bg-secondary p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-12 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    </main>
  );
}

function ModeratorUsersPageContent() {
  const router = useRouter();

  // URL Query States
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ history: "push" })
  );
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsString.withDefault("createdAt").withOptions({ history: "push" })
  );
  const [sortOrder, setSortOrder] = useQueryState(
    "sortOrder",
    parseAsString.withDefault("desc").withOptions({ history: "push" })
  );
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ throttleMs: 400, history: "push" })
  );

  // Local State
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageCount, setPageCount] = useState<number>(1);

  // Dialog States
  const [userForView, setUserForView] = useState<User | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState<boolean>(false);
  const [userForUpdate, setUserForUpdate] = useState<User | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState<boolean>(false);
  const [userForDeletion, setUserForDeletion] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState<boolean>(false);
  const [isSortDialogOpen, setIsSortDialogOpen] = useState<boolean>(false);
  const [statsKey, setStatsKey] = useState(0);

  // Derived State
  const pageIndex = page - 1;
  const sorting = useMemo<SortingState>(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder]
  );
  const filters: ModeratorUserFilters = useMemo(() => ({}), []);

  const handleOpenViewDialog = useCallback((user: User) => {
    setUserForView(user);
    setIsViewDialogOpen(true);
  }, []);

  const handleOpenDetails = useCallback((user: User) => {
    setUserForUpdate(user);
    setIsUpdateDialogOpen(true);
  }, []);

  const handleOpenDeleteDialog = useCallback((user: User) => {
    setUserForDeletion(user);
    setIsDeleteDialogOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      getColumns(
        handleOpenViewDialog,
        handleOpenDetails,
        handleOpenDeleteDialog
      ),
    [handleOpenDeleteDialog, handleOpenDetails, handleOpenViewDialog]
  );

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sortBy: resolveSortField(sortBy),
        sortOrder: sortOrder,
      });

      if (search.trim().length > 0) {
        query.set("search", search.trim());
      }

      const response = await fetch(`/api/user/all?${query.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (response.status === 403) {
        router.push("/unauthorized");
        return;
      }

      if (!response.ok || !result.success || !result.data) {
        toast.error(
          result?.error?.message ||
          "Unable to load users. Please try again later."
        );
        return;
      }

      const { users: nextUsers, pagination } = result.data as UserListResponse;

      setUsers(nextUsers);

      const totalPages = Math.max(1, pagination.totalPages || 1);
      setPageCount(totalPages);

      const normalizedPage = Math.max(1, pagination.page);
      if (normalizedPage !== page) {
        // Sync logic if needed
      }
    } catch (error) {
      console.error("[ModeratorUsersPage] Failed to fetch users", error);
      toast.error("Something went wrong while loading users.");
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortOrder, search, router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handlePageChange = (nextPageIndex: number) => {
    setPage(nextPageIndex + 1);
  };

  const handleSortChange = (updater: Updater<SortingState>) => {
    const nextState =
      typeof updater === "function" ? updater(sorting) : updater;

    if (nextState.length > 0) {
      const { id, desc } = nextState[0];
      setSortBy(id);
      setSortOrder(desc ? "desc" : "asc");
    } else {
      setSortBy("createdAt");
      setSortOrder("desc");
    }
  };

  const handleFilterChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRefresh = () => {
    fetchUsers();
  };

  const handleUserUpdated = useCallback((updatedUser: User) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === updatedUser.id ? updatedUser : user))
    );
  }, []);

  const handleUserDeleted = useCallback(
    (deletedUserId: string) => {
      setUsers((prev) => prev.filter((user) => user.id !== deletedUserId));
      fetchUsers();
      setStatsKey((prev) => prev + 1);
    },
    [fetchUsers]
  );

  const handleApplyFilters = (nextFilters: ModeratorUserFilters) => {
    setPage(1);
    setIsFilterDialogOpen(false);
  };

  const handleClearFilters = () => {
    setPage(1);
  };

  const handleApplySort = (sort: ModeratorUserSort) => {
    setSortBy(sort.field);
    setSortOrder(sort.order);
    setPage(1);
    setIsSortDialogOpen(false);
  };

  const handleClearSort = () => {
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

  const activeSort: ModeratorUserSort | null = sorting[0]
    ? {
      field: resolveSortField(sorting[0].id) as ModeratorUserSort["field"],
      order: sorting[0].desc ? "desc" : "asc",
    }
    : null;

  return (
    <main className="min-h-screen bg-secondary p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <Breadcrumb>
          <BreadcrumbList className="text-xs sm:text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/user">User Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/moderator">Moderator Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Manage Users</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold font-serif">Manage Users</h1>
            <p className="text-muted-foreground">
              Review and manage all registered users across the platform.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <UserStats key={`stats-${statsKey}`} />
          <UserGrowthChart key={`chart-${statsKey}`} />
        </div>

        <DataTable
          columns={columns}
          data={users}
          pageCount={pageCount}
          onPageChange={handlePageChange}
          onSortChange={handleSortChange}
          onFilterChange={handleFilterChange}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          pageIndex={pageIndex}
          pageSize={PAGE_SIZE}
          sorting={sorting}>
          <div className="grid grid-cols-2 w-full gap-2 sm:flex sm:w-auto sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFilterDialogOpen(true)}
              className="h-10 w-full sm:w-auto gap-2 border-border/60">
              <FilterIcon className="h-4 w-4" />
              Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSortDialogOpen(true)}
              className="h-10 w-full sm:w-auto gap-2 border-border/60">
              <SortDescIcon className="h-4 w-4" />
              Sort
            </Button>
          </div>
        </DataTable>
      </div>

      <AdminUserViewDialog
        user={userForView}
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {
            setUserForView(null);
          }
        }}
      />

      <AdminUserUpdateDialog
        user={userForUpdate}
        open={isUpdateDialogOpen}
        onOpenChange={(open) => {
          setIsUpdateDialogOpen(open);
          if (!open) {
            setUserForUpdate(null);
          }
        }}
        onUpdated={handleUserUpdated}
      />

      <AdminUserDeleteDialog
        user={userForDeletion}
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setUserForDeletion(null);
          }
        }}
        onDeleted={handleUserDeleted}
      />

      <ModeratorUserFilterDialog
        open={isFilterDialogOpen}
        onOpenChange={setIsFilterDialogOpen}
        initialFilters={filters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      <ModeratorUserSortDialog
        open={isSortDialogOpen}
        onOpenChange={setIsSortDialogOpen}
        initialSort={activeSort}
        onApply={handleApplySort}
        onClear={handleClearSort}
      />
    </main>
  );
}

export default function ModeratorUsersPage() {
  return (
    <Suspense fallback={<ModeratorUsersPageFallback />}>
      <ModeratorUsersPageContent />
    </Suspense>
  );
}
