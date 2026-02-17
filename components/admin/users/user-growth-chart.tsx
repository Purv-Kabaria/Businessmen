"use client";

import { useEffect, useState } from "react";
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import { Loader2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ChartData {
    date: string;
    count: number;
}

export function UserGrowthChart() {
    const [data, setData] = useState<ChartData[]>([]);
    const [period, setPeriod] = useState("30d");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/analytics/user-growth?period=${period}`);
                if (response.ok) {
                    const result = await response.json();
                    if (isMounted && result.success && result.data) {
                        setData(result.data);
                    }
                } else {
                    if (isMounted) toast.error("Failed to load user growth data");
                }
            } catch (error) {
                console.error("Failed to fetch user growth data", error);
                if (isMounted) toast.error("Failed to load user growth data");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [period]);

    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex flex-col space-y-1">
                    <CardTitle className="text-base font-semibold">User Growth</CardTitle>
                    <CardDescription>New users over time</CardDescription>
                </div>
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[120px] h-8 text-xs cursor-pointer">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent align="end" className="w-[120px]">
                        <SelectItem value="24h" className="cursor-pointer">24 Hours</SelectItem>
                        <SelectItem value="7d" className="cursor-pointer">7 Days</SelectItem>
                        <SelectItem value="30d" className="cursor-pointer">30 Days</SelectItem>
                        <SelectItem value="1y" className="cursor-pointer">1 Year</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="pl-0">
                <div className="h-[300px] w-full mt-4">
                    {isLoading ? (
                        <div className="flex h-full w-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={data}
                                margin={{
                                    top: 10,
                                    right: 30,
                                    left: 0,
                                    bottom: 0,
                                }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={30}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                    allowDecimals={false}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                Date
                                                            </span>
                                                            <span className="font-bold text-muted-foreground">
                                                                {label}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                Users
                                                            </span>
                                                            <span className="font-bold text-primary">
                                                                {payload?.[0]?.value}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#8884d8"
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            No data available for this period.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
