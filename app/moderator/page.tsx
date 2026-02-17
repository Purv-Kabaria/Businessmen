"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Users, FileAudio, TrendingUp, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CaptureSyncButtons } from "@/components/offline/capture-sync-buttons";

interface Analytics {
  totalUsers: number;
  totalModerators: number;
  totalAdmins: number;
  totalContacts?: number;
  totalInteractions?: number;
}

export default function ModeratorPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, userRes] = await Promise.all([
          fetch("/api/analytics/users"),
          fetch("/api/user/read", { credentials: "include" }),
        ]);
        if (!analyticsRes.ok) {
          router.push("/login");
          return;
        }
        const result = await analyticsRes.json();
        if (result.success && result.data) {
          setAnalytics(result.data);
        } else {
          router.push("/login");
          return;
        }
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData?.success && userData?.data?.role === "ADMIN") {
            setIsAdmin(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
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
              <BreadcrumbPage>Moderator</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
              <Link href="/user">
                <ChevronLeft className="h-4 w-4 mr-1 shrink-0" /> Back
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">Moderator dashboard</h1>
          </div>
          <CaptureSyncButtons />
        </div>

        {
          analytics && (
            <section className="mb-8">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Overview</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card className="border">
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total users</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 px-4">
                    <p className="text-2xl font-semibold">{analytics.totalUsers}</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Moderators</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 px-4">
                    <p className="text-2xl font-semibold">{analytics.totalModerators}</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 px-4">
                    <p className="text-2xl font-semibold">{analytics.totalAdmins}</p>
                  </CardContent>
                </Card>
                {typeof analytics.totalContacts === "number" && (
                  <Card className="border">
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Contacts</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4 px-4">
                      <p className="text-2xl font-semibold">{analytics.totalContacts}</p>
                    </CardContent>
                  </Card>
                )}
                {typeof analytics.totalInteractions === "number" && (
                  <Card className="border">
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Interactions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4 px-4">
                      <p className="text-2xl font-semibold">{analytics.totalInteractions}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          )
        }

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Actions</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/moderator/users">
              <Card className="border hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Manage users
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  <p className="text-sm text-muted-foreground">
                    View, create, edit, and delete users.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/moderator/audio">
              <Card className="border hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <FileAudio className="h-4 w-4 text-muted-foreground" />
                    Audio review
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  <p className="text-sm text-muted-foreground">
                    Listen to recordings and view contact details.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/moderator/deals">
              <Card className="border hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Deal review
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  <p className="text-sm text-muted-foreground">
                    Review interactions and add verdicts or remarks.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>
      </div >
    </main >
  );
}

