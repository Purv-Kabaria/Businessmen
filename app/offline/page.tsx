"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WifiOff, Mic, UserPlus } from "lucide-react";

// Dynamically import client-only components that use Dexie/IndexedDB
const QuickCaptureForm = dynamic(() => import("@/components/offline/quick-capture-form").then(mod => mod.QuickCaptureForm), { ssr: false });
const InteractionCapture = dynamic(() => import("@/components/offline/interaction-capture").then(mod => mod.InteractionCapture), { ssr: false });
const SyncIndicator = dynamic(() => import("@/components/offline/sync-indicator").then(mod => mod.SyncIndicator), { ssr: false });

export default function OfflinePage() {
    return (
        <div className="container max-w-lg mx-auto p-4 space-y-6 pb-20">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Offline Mode</h1>
                    <p className="text-sm text-muted-foreground">Capture data without internet.</p>
                </div>
                <SyncIndicator />
            </div>

            <Tabs defaultValue="stall" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="stall">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Stall Mode
                    </TabsTrigger>
                    <TabsTrigger value="field">
                        <Mic className="mr-2 h-4 w-4" />
                        Field Mode
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="stall" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Contact Capture</CardTitle>
                            <CardDescription>
                                Fast entry for high-volume scenarios. Saves locally instantly.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <QuickCaptureForm />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="field" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Interaction Log</CardTitle>
                            <CardDescription>
                                Record audio notes and context for existing contacts.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <InteractionCapture />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Offline Status Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-2 bg-background/80 backdrop-blur border-t text-center text-xs text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                    <WifiOff className="h-3 w-3" />
                    Data is stored securely on your device until synced.
                </div>
            </div>
        </div>
    );
}
