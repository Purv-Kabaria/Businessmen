"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Loader2, ChevronLeft, ChevronRight, Pencil, Download, Mail, Trash2, Inbox } from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

type Verdict = boolean | null;

type FollowupStatus = "Met" | "Email_sent" | "Closed" | "Rejected" | null;

interface DealRow {
    id: string;
    createdAt: string;
    dealProfitable: Verdict;
    dealEngaging: Verdict;
    dealWorthy: Verdict;
    dealRemarks: string | null;
    followupStatus: FollowupStatus;
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

const FOLLOWUP_NONE_VALUE = "__none__";
const followupStatusOptions: { value: string; label: string }[] = [
    { value: FOLLOWUP_NONE_VALUE, label: "—" },
    { value: "Met", label: "Met" },
    { value: "Email_sent", label: "Email sent" },
    { value: "Meeting_scheduled", label: "Meeting scheduled" },
    { value: "Closed", label: "Closed" },
    { value: "Rejected", label: "Rejected" },
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

export default function ModeratorDealsPage() {
    const [rows, setRows] = useState<DealRow[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    // UI States
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
    const [remarksDraft, setRemarksDraft] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);

    // Admin/Edit Modal States
    const [isAdmin, setIsAdmin] = useState(false);
    const [editRow, setEditRow] = useState<DealRow | null>(null);
    const [editDraft, setEditDraft] = useState<Omit<Partial<DealRow>, "contact"> & { contact?: Partial<DealRow["contact"]> } | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Fetch replies & auto-schedule
    const [fetchingReplies, setFetchingReplies] = useState(false);
    const [repliesResult, setRepliesResult] = useState<{
        processed: number;
        scheduled: { threadId: string; subject: string; attendeeEmail: string | null; meetLink: string | null; start: string; end: string }[];
        errors: string[];
    } | null>(null);

    useEffect(() => {
        fetchDeals(page);
    }, [page]);

    useEffect(() => {
        fetch("/api/user/read", { credentials: "include" })
            .then((r) => r.json())
            .then((data) => { if (data?.data?.role === "ADMIN") setIsAdmin(true); })
            .catch(() => { });
    }, []);

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

            // Optional: visual feedback for auto-save success, though seeing the value stick is usually enough
            // toast.success("Saved"); 
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Update failed");
        } finally {
            setUpdatingId(null);
        }
    }

    function handleSelect(interactionId: string, field: "dealProfitable" | "dealEngaging" | "dealWorthy", value: string) {
        updateVerdict(interactionId, field, valueToVerdict(value));
    }

    async function handleFollowupStatusChange(interactionId: string, value: FollowupStatus) {
        setUpdatingId(interactionId);
        try {
            const res = await fetch("/api/moderator/deals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ interactionId, followupStatus: value }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Update failed");
            setRows((prev) =>
                prev.map((r) => (r.id === interactionId ? { ...r, followupStatus: value } : r))
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Update failed");
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleSendEmail(row: DealRow) {
        if (!row.contact.email?.trim()) {
            toast.error("No email address for this contact");
            return;
        }
        setSendingEmailId(row.id);
        try {
            const res = await fetch("/api/moderator/deals/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ interactionId: row.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Send failed");
            setRows((prev) =>
                prev.map((r) => (r.id === row.id ? { ...r, followupStatus: "Email_sent" as const } : r))
            );
            toast.success(`Email sent to ${row.contact.email}`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to send email");
        } finally {
            setSendingEmailId(null);
        }
    }

    async function handleFetchRepliesAndSchedule() {
        setFetchingReplies(true);
        setRepliesResult(null);
        try {
            const res = await fetch("/api/integrations/meeting-schedule/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ maxThreads: 15, inboxQuery: "in:inbox is:unread" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message ?? "Failed to run");
            const result = data.data ?? {};
            setRepliesResult({
                processed: result.processed ?? 0,
                scheduled: result.scheduled ?? [],
                errors: result.errors ?? [],
            });
            if ((result.scheduled ?? []).length > 0) {
                toast.success(`Scheduled ${result.scheduled.length} meeting(s); reply emails sent.`);
            } else if ((result.errors ?? []).length > 0) {
                toast.info("Run complete. No new meetings scheduled; check results for details.");
            } else {
                toast.info("No promising replies found in inbox. Update follow-up below for leads.");
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to fetch replies");
        } finally {
            setFetchingReplies(false);
        }
    }

    // Auto-save triggers on blur
    function handleRemarksBlur(interactionId: string) {
        const value = remarksDraft[interactionId] ?? "";
        const row = rows.find((r) => r.id === interactionId);
        // Only call API if value actually changed
        if (row && (row.dealRemarks ?? "") !== value) {
            updateVerdict(interactionId, "dealRemarks", value || null);
        }
    }

    function openEditModal(row: DealRow) {
        setEditRow(row);
        setEditDraft({
            ...row,
            contact: { ...row.contact },
        });
    }

    async function saveEditModal() {
        if (!editRow || !editDraft) return;
        setUpdatingId(editRow.id);
        try {
            const body: Record<string, unknown> = {
                interactionId: editRow.id,
                dealProfitable: editDraft.dealProfitable,
                dealEngaging: editDraft.dealEngaging,
                dealWorthy: editDraft.dealWorthy,
                dealRemarks: editDraft.dealRemarks === "" ? null : editDraft.dealRemarks ?? null,
                followupStatus: editDraft.followupStatus,
                contact: editDraft.contact
                    ? {
                        name: editDraft.contact.name ?? null,
                        company: editDraft.contact.company ?? null,
                        phone: editDraft.contact.phone ?? "",
                        email: editDraft.contact.email ?? null,
                    }
                    : undefined,
            };
            const res = await fetch("/api/moderator/deals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Update failed");
            setRows((prev) =>
                prev.map((r) =>
                    r.id === editRow.id
                        ? {
                            ...r,
                            ...editDraft,
                            contact: { ...r.contact, ...editDraft.contact },
                        }
                        : r
                )
            );
            setRemarksDraft((p) => ({ ...p, [editRow.id]: (editDraft.dealRemarks ?? "") as string }));
            setEditRow(null);
            setEditDraft(null);
            toast.success("Entry updated");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Update failed");
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleDeleteInteraction(interactionId: string) {
        setDeletingId(interactionId);
        try {
            const res = await fetch(`/api/moderator/deals?interactionId=${encodeURIComponent(interactionId)}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Delete failed");
            setRows((prev) => prev.filter((r) => r.id !== interactionId));
            setDeleteTargetId(null);
            toast.success("Entry deleted");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
        } finally {
            setDeletingId(null);
        }
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
                            <p className="text-sm text-muted-foreground">Review interactions. Changes save automatically.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={handleFetchRepliesAndSchedule}
                            disabled={fetchingReplies}
                            title="Fetch Gmail replies from DB contacts, classify with AI, and send meeting invite emails for promising leads"
                        >
                            {fetchingReplies ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Inbox className="h-3.5 w-3.5" />}
                            Fetch replies & schedule
                        </Button>
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
                                    <TableHead className="w-[140px] text-xs font-medium text-muted-foreground">Follow-up</TableHead>
                                    <TableHead className="w-[100px] text-xs font-medium text-muted-foreground">Email</TableHead>
                                    <TableHead className="text-xs font-medium text-muted-foreground">Remarks</TableHead>
                                    <TableHead className="w-[120px] text-right text-xs font-medium text-muted-foreground">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.id} className={updatingId === row.id ? "opacity-70 transition-opacity" : "transition-opacity"}>
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
                                            <Select
                                                value={row.followupStatus ?? FOLLOWUP_NONE_VALUE}
                                                onValueChange={(v) => handleFollowupStatusChange(row.id, v === FOLLOWUP_NONE_VALUE ? null : (v as FollowupStatus))}
                                                disabled={updatingId === row.id}
                                            >
                                                <SelectTrigger className="w-[130px] h-8">
                                                    <SelectValue placeholder="—" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {followupStatusOptions.map((o) => (
                                                        <SelectItem key={o.value} value={o.value}>
                                                            {o.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1.5"
                                                disabled={!row.contact.email?.trim() || sendingEmailId === row.id}
                                                onClick={() => handleSendEmail(row)}
                                                title={row.contact.email?.trim() ? `Send email to ${row.contact.email}` : "No email address"}
                                            >
                                                {sendingEmailId === row.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Mail className="h-3.5 w-3.5" />
                                                )}
                                                Send
                                            </Button>
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
                                            <div className="flex items-center justify-end gap-1 flex-wrap">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => openEditModal(row)}
                                                    disabled={updatingId === row.id}
                                                    title="Edit details"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>

                                                {isAdmin && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setDeleteTargetId(row.id)}
                                                        disabled={deletingId !== null}
                                                        title="Delete entry (Admin)"
                                                    >
                                                        {deletingId === row.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
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

                {/* Edit details dialog */}
                <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) { setEditRow(null); setEditDraft(null); } }}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Deal</DialogTitle>
                            <DialogDescription>Modify contact details and deal verdicts.</DialogDescription>
                        </DialogHeader>
                        {editRow && editDraft && (
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Contact name</Label>
                                        <Input
                                            value={editDraft.contact?.name ?? ""}
                                            onChange={(e) => setEditDraft((d) => d ? { ...d, contact: { ...d.contact, name: e.target.value || null } } : null)}
                                            placeholder="Name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Company</Label>
                                        <Input
                                            value={editDraft.contact?.company ?? ""}
                                            onChange={(e) => setEditDraft((d) => d ? { ...d, contact: { ...d.contact, company: e.target.value || null } } : null)}
                                            placeholder="Company"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Phone</Label>
                                        <Input
                                            value={editDraft.contact?.phone ?? ""}
                                            onChange={(e) => setEditDraft((d) => d ? { ...d, contact: { ...d.contact, phone: e.target.value } } : null)}
                                            placeholder="Phone"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input
                                            type="email"
                                            value={editDraft.contact?.email ?? ""}
                                            onChange={(e) => setEditDraft((d) => d ? { ...d, contact: { ...d.contact, email: e.target.value || null } } : null)}
                                            placeholder="Email"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Profitable</Label>
                                        <Select
                                            value={verdictToValue(editDraft.dealProfitable ?? null)}
                                            onValueChange={(v) => setEditDraft((d) => d ? { ...d, dealProfitable: valueToVerdict(v) } : null)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                {profitableOptions.map((o) => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Engaging</Label>
                                        <Select
                                            value={verdictToValue(editDraft.dealEngaging ?? null)}
                                            onValueChange={(v) => setEditDraft((d) => d ? { ...d, dealEngaging: valueToVerdict(v) } : null)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                {engagingOptions.map((o) => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Worthy</Label>
                                        <Select
                                            value={verdictToValue(editDraft.dealWorthy ?? null)}
                                            onValueChange={(v) => setEditDraft((d) => d ? { ...d, dealWorthy: valueToVerdict(v) } : null)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                {worthyOptions.map((o) => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Follow-up</Label>
                                    <Select
                                        value={(editDraft.followupStatus ?? FOLLOWUP_NONE_VALUE) as string}
                                        onValueChange={(v) => setEditDraft((d) => d ? { ...d, followupStatus: v === FOLLOWUP_NONE_VALUE ? null : (v as FollowupStatus) } : null)}
                                    >
                                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                        <SelectContent>
                                            {followupStatusOptions.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Remarks</Label>
                                    <Input
                                        value={editDraft.dealRemarks ?? ""}
                                        onChange={(e) => setEditDraft((d) => d ? { ...d, dealRemarks: e.target.value || null } : null)}
                                        placeholder="Remarks..."
                                    />
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setEditRow(null); setEditDraft(null); }}>Cancel</Button>
                            <Button onClick={saveEditModal} disabled={!editRow || updatingId !== null}>
                                {updatingId === editRow?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Fetch replies & schedule result */}
                <Dialog open={!!repliesResult} onOpenChange={(open) => { if (!open) setRepliesResult(null); }}>
                    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Replies & schedule result</DialogTitle>
                            <DialogDescription>
                                Threads from DB contacts were checked. Promising leads got a meeting and a reply email with the Meet link. For others, update the follow-up value in the table below.
                            </DialogDescription>
                        </DialogHeader>
                        {repliesResult && (
                            <div className="space-y-4 text-sm">
                                <p className="text-muted-foreground">
                                    Processed <strong>{repliesResult.processed}</strong> thread(s). Scheduled <strong>{repliesResult.scheduled.length}</strong> meeting(s).
                                </p>
                                {repliesResult.scheduled.length > 0 && (
                                    <div>
                                        <p className="font-medium mb-2">Scheduled (reply email sent)</p>
                                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                            {repliesResult.scheduled.map((s, i) => (
                                                <li key={s.threadId ?? i}>
                                                    {s.subject ?? "—"} → {s.attendeeEmail ?? "—"}
                                                    {s.start && (
                                                        <span className="block text-xs mt-0.5">
                                                            {format(new Date(s.start), "PPp")}
                                                            {s.meetLink && " · "}
                                                            {s.meetLink && (
                                                                <a href={s.meetLink} target="_blank" rel="noreferrer" className="text-primary underline">Join</a>
                                                            )}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {repliesResult.errors.length > 0 && (
                                    <div>
                                        <p className="font-medium text-destructive mb-2">Errors</p>
                                        <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                                            {repliesResult.errors.map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        <DialogFooter>
                            <Button onClick={() => setRepliesResult(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete confirmation */}
                <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete this interaction and its deal review. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteTargetId && handleDeleteInteraction(deleteTargetId)}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </main>
    );
}