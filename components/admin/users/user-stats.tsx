"use client";

import { useEffect, useState } from "react";
import { Loader2, Shield, UserCheck, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


interface Analytics {
    totalUsers: number;
    totalModerators: number;
    totalAdmins: number;
}

export function UserStats() {
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchAnalytics = async () => {
            try {
                const response = await fetch("/api/analytics/users");
                if (response.ok) {
                    const result = await response.json();
                    if (isMounted && result.success && result.data) {
                        setAnalytics(result.data);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch analytics", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchAnalytics();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full">
            <div>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <div className="text-2xl font-bold">
                                {analytics?.totalUsers || 0}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Moderators
                        </CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <div className="text-2xl font-bold">
                                {analytics?.totalModerators || 0}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                            <div className="text-2xl font-bold">
                                {analytics?.totalAdmins || 0}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
