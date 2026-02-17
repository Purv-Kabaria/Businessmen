"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { syncService } from "@/lib/sync-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    CloudOff,
    Cloud
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SyncIndicator() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    // Real-time count of pending items
    const pendingContacts = useLiveQuery(() =>
        db.contacts.where("syncStatus").equals("pending").count()
    );

    const pendingInteractions = useLiveQuery(() =>
        db.interactions.where("syncStatus").equals("pending").count()
    );

    const pendingCount = (pendingContacts || 0) + (pendingInteractions || 0);

    async function handleSync() {
        if (pendingCount === 0) return;

        setIsSyncing(true);
        setLastError(null);

        try {
            const stats = await syncService.syncPendingData();

            if (stats.errors.length > 0) {
                setLastError(stats.errors[0]); // Show first error
                toast.error(`Sync finished with errors: ${stats.errors[0]}`);
            } else {
                toast.success(`Successfully synced ${stats.contactsSuccess + stats.interactionsSuccess} items!`);
            }
        } catch (error: any) {
            console.error("Sync failed:", error);
            setLastError(error.message);
            toast.error("Sync failed completely. Please try again later.");
        } finally {
            setIsSyncing(false);
        }
    }

    // Determine State
    const isPending = pendingCount > 0;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    return (
        <div className="flex items-center gap-2">
            {/* Network Status Icon (Hidden if online to reduce clutter, or subtle) */}
            {!isOnline && (
                <Badge variant="outline" className="text-muted-foreground gap-1 border-dashed">
                    <CloudOff className="h-3 w-3" />
                    Offline
                </Badge>
            )}

            {/* Sync Status Button */}
            <Button
                variant={isPending ? "default" : "outline"}
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || pendingCount === 0}
                className={cn(
                    "gap-2 transition-all duration-300",
                    isPending ? "animate-pulse-subtle config-highlight" : "text-muted-foreground"
                )}
            >
                {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPending ? (
                    <RefreshCw className="h-4 w-4" />
                ) : lastError ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}

                <span className="hidden sm:inline">
                    {isSyncing
                        ? "Syncing..."
                        : isPending
                            ? `${pendingCount} Pending`
                            : lastError
                                ? "Sync Failed"
                                : "Synced"}
                </span>
            </Button>
        </div>
    );
}
