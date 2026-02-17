"use client";

import { useSyncManager } from "@/hooks/use-sync-manager";

export function SyncOrchestrator() {
    useSyncManager(); // Initializes the background sync logic
    return null; // Renders nothing visible
}
