"use client";

import dynamic from "next/dynamic";

const SyncOrchestrator = dynamic(
    () => import("./sync-orchestrator").then((mod) => mod.SyncOrchestrator),
    { ssr: false }
);

export function SyncOrchestratorLoader() {
    return <SyncOrchestrator />;
}
