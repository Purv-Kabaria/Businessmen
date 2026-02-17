"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight, Pencil, Check, X, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Verdict = boolean | null;

interface DealRow {
    id: string;
    createdAt: string;
    dealProfitable: Verdict;
    dealEngaging: Verdict;
    dealWorthy: Verdict;
    dealRemarks: string | null;
    contact: { id: string; name: string | null; phone: string; email: string | null; company: string | null };
    createdBy: { id: string; fullName: string; email: string };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const verdictOptions = [
    { value: "unset", label: "—" },
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
] as const;

const profitableOptions = [
    { value: "unset", label: "—" },
    { value: "yes", label: "Profitable" },
    { value: "no", label: "Non-profitable" },
];
const engagingOptions = [
    { value: "unset", label: "—" },
    { value: "yes", label: "Engaging" },
    { value: "no", label: "Non-engaging" },
];
const worthyOptions = [
    { value: "unset", label: "—" },
    { value: "yes", label: "Worthy" },
    { value: "no", label: "Not worthy" },
];

function verdictToValue(v: Verdict): "yes" | "no" | "unset" {
    if (v === true) return "yes";
    if (v === false) return "no";
    return "unset";
}

function valueToVerdict(v: string): Verdict {
    if (v === "yes") return true;
    if (v === "no") return false;
    return null;
}

function isRowSettled(row: DealRow): boolean {
    const hasVerdict =
        row.dealProfitable === true || row.dealProfitable === false ||
        row.dealEngaging === true || row.dealEngaging === false ||
        row.dealWorthy === true || row.dealWorthy === false;
    const hasRemarks = row.dealRemarks != null && String(row.dealRemarks).trim() !== "";
    return hasVerdict || hasRemarks;
}

export default function ModeratorDealsPage() {
    const [rows, setRows] = useState<DealRow[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [remarksDraft, setRemarksDraft] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchDeals(page);
    }, [page]);

    async function fetchDeals(p: number) {
        setLoading(true);
        try {
            const res = await fetch(`/api/moderator/deals?page=${p}&limit=15`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Failed to load");
            setRows(data.data?.interactions ?? []);
            setPagination(data.data?.pagination ?? null);
            setRemarksDraft((prev) => {
                const next = { ...prev };
                (data.data?.interactions ?? []).forEach((r: DealRow) => {
                    if (r.dealRemarks != null) next[r.id] = r.dealRemarks;
                });
                return next;
            });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to load deals");
            setRows([]);
            setPagination(null);
        } finally {
            setLoading(false);
        }
    }

    async function updateVerdict(interactionId: string, field: "dealProfitable" | "dealEngaging" | "dealWorthy" | "dealRemarks", value: Verdict | string) {
        setUpdatingId(interactionId);
        try {
            const body: Record<string, unknown> = { interactionId, [field]: value };
            if (field === "dealRemarks") body.dealRemarks = value === "" ? null : value;
            const res = await fetch("/api/moderator/deals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Update failed");
            setRows((prev) =>
                prev.map((r) => (r.id === interactionId ? { ...r, [field]: field === "dealRemarks" ? (value as string) || null : value } : r))
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Update failed");
        } finally {
            setUpdatingId(null);
        }
    }

    function handleSelect(interactionId: string, field: "dealProfitable" | "dealEngaging" | "dealWorthy", value: string) {
        updateVerdict(interactionId, field, valueToVerdict(value));
    }

    function handleRemarksBlur(interactionId: string) {
        const value = remarksDraft[interactionId] ?? "";
        const row = rows.find((r) => r.id === interactionId);
        if (row && (row.dealRemarks ?? "") !== value) updateVerdict(interactionId, "dealRemarks", value || null);
    }

    async function saveRow(interactionId: string) {
        const row = rows.find((r) => r.id === interactionId);
        if (!row) return;
        const remarks = remarksDraft[interactionId] ?? row.dealRemarks ?? "";
        setUpdatingId(interactionId);
        try {
            const res = await fetch("/api/moderator/deals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    interactionId,
                    dealProfitable: row.dealProfitable,
                    dealEngaging: row.dealEngaging,
                    dealWorthy: row.dealWorthy,
                    dealRemarks: remarks === "" ? null : remarks,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Save failed");
            const updated = data?.data;
            setRows((prev) =>
                prev.map((r) =>
                    r.id === interactionId
                        ? {
                            ...r,
                            dealProfitable: updated?.dealProfitable ?? r.dealProfitable,
                            dealEngaging: updated?.dealEngaging ?? r.dealEngaging,
                            dealWorthy: updated?.dealWorthy ?? r.dealWorthy,
                            dealRemarks: updated?.dealRemarks ?? (remarks === "" ? null : remarks),
                        }
                        : r
                )
            );
            setEditingId(null);
            toast.success("Deal review saved");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Save failed");
        } finally {
            setUpdatingId(null);
        }
    }

    function cancelEdit(interactionId: string) {
        const row = rows.find((r) => r.id === interactionId);
        if (row) setRemarksDraft((p) => ({ ...p, [interactionId]: row.dealRemarks ?? "" }));
        setEditingId(null);
    }

    async function handleExportCSV() {
        setIsExporting(true);
        try {
            const response = await fetch("/api/moderator/deals/export/csv", { credentials: "include" });
            if (!response.ok) throw new Error("Export failed");
            const blob = await response.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `deal_reviews_${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
            toast.success("CSV downloaded");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to download CSV");
        } finally {
            setIsExporting(false);
        }
    }

    return (
        <main className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
            <div className="mx-auto max-w-7xl">
                <Breadcrumb className="mb-4 sm:mb-6">
                    <BreadcrumbList className="text-xs sm:text-sm">
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/">Home</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/user">User</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/moderator">Moderator</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Deal review</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground shrink-0">
                            <Link href="/moderator">
                                <ChevronLeft className="h-4 w-4 mr-1" /> Back
                            </Link>
                        </Button>
                        <div className="min-w-0">
                            <h1 className="text-xl font-semibold">Deal review</h1>
                            <p className="text-sm text-muted-foreground">Review interactions and add verdicts or remarks.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={handleExportCSV}
                        disabled={isExporting}
                    >
                        {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Export CSV
                    </Button>
                    {pagination && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm tabular-nums">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= pagination.totalPages || loading}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </>
                        )}
                    </div>
                </div>

                <div className="rounded-lg border overflow-hidden">
                    {loading && rows.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <p className="text-sm">No interactions to review yet.</p>
                            <Link href="/moderator/audio">
                                <Button variant="outline" size="sm" className="mt-3">Go to Audio review</Button>
                            </Link>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b">
                                    <TableHead className="w-[140px] text-xs font-medium text-muted-foreground">Contact</TableHead>
                                    <TableHead className="w-[120px] text-xs font-medium text-muted-foreground">Company</TableHead>
                                    <TableHead className="w-[120px] text-xs font-medium text-muted-foreground">Phone</TableHead>
                                    <TableHead className="w-[100px] text-xs font-medium text-muted-foreground">Date</TableHead>
                                    <TableHead className="w-[140px] text-xs font-medium text-muted-foreground">Profitable</TableHead>
                                    <TableHead className="w-[140px] text-xs font-medium text-muted-foreground">Engaging</TableHead>
                                    <TableHead className="w-[140px] text-xs font-medium text-muted-foreground">Worthy</TableHead>
                                    <TableHead className="text-xs font-medium text-muted-foreground">Remarks</TableHead>
                                    <TableHead className="w-[140px] text-right text-xs font-medium text-muted-foreground">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.id} className={updatingId === row.id ? "opacity-70" : ""}>
                                        <TableCell className="font-medium truncate max-w-[140px]" title={row.contact.name ?? row.contact.phone}>
                                            {row.contact.name || "—"}
                                        </TableCell>
                                        <TableCell className="truncate max-w-[120px]" title={row.contact.company ?? undefined}>
                                            {row.contact.company || "—"}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs truncate max-w-[120px]">{row.contact.phone}</TableCell>
                                        <TableCell className="text-muted-foreground whitespace-nowrap">
                                            {format(new Date(row.createdAt), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={verdictToValue(row.dealProfitable)}
                                                onValueChange={(v) => handleSelect(row.id, "dealProfitable", v)}
                                                disabled={updatingId === row.id}
                                            >
                                                <SelectTrigger className="w-[130px] h-8">
                                                    <SelectValue placeholder="—" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {profitableOptions.map((o) => (
                                                        <SelectItem key={o.value} value={o.value}>
                                                            {o.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={verdictToValue(row.dealEngaging)}
                                                onValueChange={(v) => handleSelect(row.id, "dealEngaging", v)}
                                                disabled={updatingId === row.id}
                                            >
                                                <SelectTrigger className="w-[130px] h-8">
                                                    <SelectValue placeholder="—" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {engagingOptions.map((o) => (
                                                        <SelectItem key={o.value} value={o.value}>
                                                            {o.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={verdictToValue(row.dealWorthy)}
                                                onValueChange={(v) => handleSelect(row.id, "dealWorthy", v)}
                                                disabled={updatingId === row.id}
                                            >
                                                <SelectTrigger className="w-[130px] h-8">
                                                    <SelectValue placeholder="—" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {worthyOptions.map((o) => (
                                                        <SelectItem key={o.value} value={o.value}>
                                                            {o.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                className="h-8 min-w-[140px] max-w-[220px]"
                                                placeholder="Remarks..."
                                                value={remarksDraft[row.id] ?? row.dealRemarks ?? ""}
                                                onChange={(e) => setRemarksDraft((p) => ({ ...p, [row.id]: e.target.value }))}
                                                onBlur={() => handleRemarksBlur(row.id)}
                                                disabled={updatingId === row.id}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {editingId === row.id ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="h-8 gap-1"
                                                        onClick={() => saveRow(row.id)}
                                                        disabled={updatingId === row.id}
                                                    >
                                                        {updatingId === row.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Check className="h-3.5 w-3.5" />
                                                        )}
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 gap-1"
                                                        onClick={() => cancelEdit(row.id)}
                                                        disabled={updatingId === row.id}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : isRowSettled(row) ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 gap-1"
                                                    onClick={() => setEditingId(row.id)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    Edit
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="h-8 gap-1"
                                                    onClick={() => saveRow(row.id)}
                                                    disabled={updatingId === row.id}
                                                >
                                                    {updatingId === row.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Check className="h-3.5 w-3.5" />
                                                    )}
                                                    Save
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {pagination && pagination.total > 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                        {pagination.total} interaction{pagination.total !== 1 ? "s" : ""} total
                    </p>
                )}
            </div>
        </main>
    );
}
