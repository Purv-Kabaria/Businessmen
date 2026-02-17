"use client";

import { useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { syncService } from "@/lib/sync-service";
import { toast } from "sonner";

// Frequency of background sync attempts (in milliseconds)
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useSyncManager() {
    const pendingCount = useLiveQuery(async () => {
        const c = await db.contacts.where("syncStatus").equals("pending").count();
        const i = await db.interactions.where("syncStatus").equals("pending").count();
        return c + i;
    }) ?? 0;

    const performSync = useCallback(async () => {
        if (pendingCount === 0 || !navigator.onLine) return;

        try {
            console.log("Starting background sync...");
            const stats = await syncService.syncPendingData();

            if (stats.contactsSuccess > 0 || stats.interactionsSuccess > 0) {
                toast.success(`Background Sync: ${stats.contactsSuccess + stats.interactionsSuccess} items synced.`);
            }

            if (stats.errors.length > 0) {
                console.warn("Background sync encountered errors:", stats.errors);
                // Optionally show a toast for errors, but might be annoying if frequent
            }
        } catch (error) {
            console.error("Background sync failed:", error);
        }
    }, [pendingCount]);

    // 1. Listen for 'online' event
    useEffect(() => {
        const handleOnline = () => {
            toast.info("You're back online! Syncing data...");
            performSync();
        };

        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [performSync]);

    // 2. Periodic Sync
    useEffect(() => {
        const intervalId = setInterval(performSync, SYNC_INTERVAL);
        return () => clearInterval(intervalId);
    }, [performSync]);

    return {
        pendingCount,
        performSync,
    };
}
