"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Users, FileAudio, TrendingUp, LayoutDashboard } from "lucide-react";
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

interface Analytics {
  totalUsers: number;
  totalModerators: number;
  totalAdmins: number;
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <main className="min-h-screen bg-secondary p-4 sm:p-6 md:p-8">
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
                <Link href="/user">User Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Moderator Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold font-serif">Moderator Dashboard</h1>
          {isAdmin && (
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm" className="gap-1.5">
                <LayoutDashboard className="h-4 w-4" />
                Admin Dashboard
              </Button>
            </Link>
          )}
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold font-serif mb-4">Links</h2>
          <motion.div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible">
            <motion.div variants={itemVariants} className="h-full">
              <Link href="/moderator/users" className="block h-full">
                <Card className="h-full flex flex-col hover:bg-accent hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Manage Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      View, create, edit, and delete users.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
            <motion.div variants={itemVariants} className="h-full">
              <Link href="/moderator/audio" className="block h-full">
                <Card className="h-full flex flex-col hover:bg-accent hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileAudio className="h-5 w-5 text-primary" />
                      Audio Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Listen to recorded interactions and view contact details.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
            <motion.div variants={itemVariants} className="h-full">
              <Link href="/moderator/deals" className="block h-full">
                <Card className="h-full flex flex-col hover:bg-accent hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Deal Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Mark interactions as profitable, engaging, worthy and add remarks in table form.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

