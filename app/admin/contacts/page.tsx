"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { format } from "date-fns";

interface ContactRow {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    company: string | null;
    currentStage: string;
    updatedAt: string;
    _count: { interactions: number };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const LIMIT = 20;

export default function AdminContactsPage() {
    const [contacts, setContacts] = useState<ContactRow[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");

    const fetchContacts = useCallback(async (p: number, q: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
            if (q.trim()) params.set("search", q.trim());
            const res = await fetch(`/api/admin/contacts?${params}`, { credentials: "include" });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (res.status === 403) {
                window.location.href = "/unauthorized";
                return;
            }
            if (!res.ok) {
                setContacts([]);
                setPagination(null);
                return;
            }
            const json = await res.json();
            if (json?.success && json?.data) {
                setContacts(json.data.contacts ?? []);
                setPagination(json.data.pagination ?? null);
            }
        } catch {
            setContacts([]);
            setPagination(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchContacts(page, search);
    }, [page, search, fetchContacts]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput.trim());
        setPage(1);
    };

    return (
        <main className="min-h-screen bg-secondary p-4 sm:p-6 md:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
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
                                <Link href="/admin/dashboard">Admin Dashboard</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Contacts</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/dashboard">
                            <Button variant="outline" size="icon" className="shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
                            <p className="text-sm text-muted-foreground">View and search all contacts.</p>
                        </div>
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-4">
                        <form onSubmit={handleSearchSubmit} className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search by phone, name, email, company..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Button type="submit" variant="secondary">
                                Search
                            </Button>
                        </form>
                    </CardHeader>
                    <CardContent>
                        {loading && contacts.length === 0 ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Company</TableHead>
                                            <TableHead className="text-right">Interactions</TableHead>
                                            <TableHead>Updated</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {contacts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                    No contacts found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            contacts.map((c) => (
                                                <TableRow key={c.id}>
                                                    <TableCell className="font-medium">{c.name ?? "—"}</TableCell>
                                                    <TableCell>{c.phone}</TableCell>
                                                    <TableCell>{c.email ?? "—"}</TableCell>
                                                    <TableCell>{c.company ?? "—"}</TableCell>
                                                    <TableCell className="text-right">{c._count.interactions}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {format(new Date(c.updatedAt), "PP")}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                {pagination && pagination.totalPages > 1 && (
                                    <div className="mt-4 flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground">
                                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={page <= 1 || loading}
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={page >= pagination.totalPages || loading}
                                                onClick={() => setPage((p) => p + 1)}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
