"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Loader2,
    Users,
    Shield,
    UserCheck,
    Contact,
    MessageSquare,
    CalendarCheck,
    FileAudio,
    TrendingUp,
    LayoutDashboard,
    Home,
    Mic,
    Store,
    ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface AdminAnalytics {
    totalUsers: number;
    totalModerators: number;
    totalAdmins: number;
    totalContacts: number;
    totalInteractions: number;
    totalFollowUps: number;
    interactionsWithAudio: number;
    dealReviewsSettled: number;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.06 },
    },
};

const itemVariants = {
    hidden: { y: 12, opacity: 0 },
    visible: { y: 0, opacity: 1 },
};

export default function AdminDashboardPage() {
    const router = useRouter();
    const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchData() {
            try {
                const res = await fetch("/api/admin/analytics", { credentials: "include" });
                if (res.status === 401) {
                    if (!cancelled) router.push("/login");
                    return;
                }
                if (res.status === 403) {
                    if (!cancelled) router.push("/unauthorized");
                    return;
                }
                if (!res.ok) {
                    if (!cancelled) setAnalytics(null);
                    return;
                }
                const json = await res.json();
                if (!cancelled && json?.success && json?.data) setAnalytics(json.data);
            } catch {
                if (!cancelled) setAnalytics(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchData();
        return () => {
            cancelled = true;
        };
    }, [router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-secondary p-4 sm:p-6 md:p-8">
            <div className="mx-auto max-w-7xl space-y-8">
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
                                <Link href="/admin/dashboard">Admin</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Dashboard</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div>
                    <h1 className="text-3xl font-bold font-serif tracking-tight">Admin Dashboard</h1>
                    <p className="mt-1 text-muted-foreground">Site-wide analytics, data management, and quick access.</p>
                </div>

                <section>
                    <h2 className="mb-4 text-lg font-semibold font-serif">Site analytics</h2>
                    <motion.div
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div variants={itemVariants} className="h-full">
                            <Card className="h-full flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Users</CardTitle>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-2xl font-bold">{analytics?.totalUsers ?? "—"}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {analytics != null
                                            ? `${analytics.totalModerators} moderators, ${analytics.totalAdmins} admins`
                                            : "—"}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                        <motion.div variants={itemVariants} className="h-full">
                            <Card className="h-full flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Contacts</CardTitle>
                                    <Contact className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-2xl font-bold">{analytics?.totalContacts ?? "—"}</div>
                                    <p className="text-xs text-muted-foreground min-h-5"> </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                        <motion.div variants={itemVariants} className="h-full">
                            <Card className="h-full flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Interactions</CardTitle>
                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-2xl font-bold">{analytics?.totalInteractions ?? "—"}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {analytics != null ? `${analytics.interactionsWithAudio} with audio` : "—"}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                        <motion.div variants={itemVariants} className="h-full">
                            <Card className="h-full flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Follow-ups</CardTitle>
                                    <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-2xl font-bold">{analytics?.totalFollowUps ?? "—"}</div>
                                    <p className="text-xs text-muted-foreground min-h-5"> </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                        <motion.div variants={itemVariants} className="sm:col-span-2 lg:col-span-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Deal reviews</CardTitle>
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{analytics?.dealReviewsSettled ?? "—"}</div>
                                    <p className="text-xs text-muted-foreground">
                                        interactions with at least one verdict or remarks
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </motion.div>
                </section>

                <section>
                    <h2 className="mb-4 text-lg font-semibold font-serif">Manage data (CRUD)</h2>
                    <motion.div
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div variants={itemVariants}>
                            <Link href="/admin/users">
                                <Card className="h-full transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <UserCheck className="h-5 w-5 text-primary" />
                                            Users
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            Create, read, update, and delete user accounts and roles.
                                        </p>
                                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                                            Open <ExternalLink className="h-3.5 w-3" />
                                        </span>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Link href="/admin/contacts">
                                <Card className="h-full transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Contact className="h-5 w-5 text-primary" />
                                            Contacts
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            View and manage contacts and interaction counts.
                                        </p>
                                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                                            Open <ExternalLink className="h-3.5 w-3" />
                                        </span>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Link href="/moderator/audio">
                                <Card className="h-full transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <FileAudio className="h-5 w-5 text-primary" />
                                            Audio review
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            Listen to recordings and manage interaction audio.
                                        </p>
                                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                                            Open <ExternalLink className="h-3.5 w-3" />
                                        </span>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Link href="/moderator/deals">
                                <Card className="h-full transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <TrendingUp className="h-5 w-5 text-primary" />
                                            Deal review
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            Set profitable, engaging, worthy and remarks; export CSV.
                                        </p>
                                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                                            Open <ExternalLink className="h-3.5 w-3" />
                                        </span>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                    </motion.div>
                </section>

                <section>
                    <h2 className="mb-4 text-lg font-semibold font-serif">Site access</h2>
                    <motion.div
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div variants={itemVariants}>
                            <Link href="/">
                                <Card className="transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Home className="h-5 w-5" />
                                            Home
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            </Link>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Link href="/user">
                                <Card className="transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <LayoutDashboard className="h-5 w-5" />
                                            User dashboard
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            </Link>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Link href="/field">
                                <Card className="transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Mic className="h-5 w-5" />
                                            Capture (field)
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            </Link>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Link href="/stall">
                                <Card className="transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Store className="h-5 w-5" />
                                            Capture (stall)
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            </Link>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <Link href="/moderator">
                                <Card className="transition-colors hover:border-primary hover:bg-accent/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Shield className="h-5 w-5" />
                                            Moderator hub
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            </Link>
                        </motion.div>
                    </motion.div>
                </section>
            </div>
        </main>
    );
}
