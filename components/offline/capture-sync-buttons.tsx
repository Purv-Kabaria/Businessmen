"use client";

import { useState, useCallback, useEffect } from "react";
import {
    getUnsyncedContacts,
    getPendingAudioTranscriptItems,
} from "@/modules/capture/db";
import { syncContactsFromQueue, syncAudioFromQueue } from "@/lib/capture-sync";
import { Button } from "@/components/ui/button";
import { RefreshCw, Mic, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CaptureSyncButtons() {
    const [contactsPending, setContactsPending] = useState(0);
    const [audioPending, setAudioPending] = useState(0);
    const [syncingContacts, setSyncingContacts] = useState(false);
    const [syncingAudio, setSyncingAudio] = useState(false);

    const refreshCounts = useCallback(async () => {
        try {
            const [contacts, audio] = await Promise.all([
                getUnsyncedContacts(),
                getPendingAudioTranscriptItems(100),
            ]);
            setContactsPending(contacts.length);
            setAudioPending(audio.length);
        } catch {
            setContactsPending(0);
            setAudioPending(0);
        }
    }, []);

    useEffect(() => {
        refreshCounts();
    }, [refreshCounts]);

    async function handleSyncContacts() {
        if (contactsPending === 0) return;
        setSyncingContacts(true);
        try {
            const result = await syncContactsFromQueue();
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(`Enqueued ${result.enqueued} contact(s) for sync.`);
            }
            await refreshCounts();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Sync contacts failed.");
        } finally {
            setSyncingContacts(false);
        }
    }

    async function handleSyncAudio() {
        if (audioPending === 0) return;
        setSyncingAudio(true);
        try {
            const result = await syncAudioFromQueue();
            if (result.errors.length > 0) {
                toast.error(result.errors[0]);
            } else {
                toast.success(`Uploaded ${result.enqueued} audio recording(s) to S3 (WebP).`);
            }
            await refreshCounts();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Sync audio failed.");
        } finally {
            setSyncingAudio(false);
        }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={handleSyncContacts}
                disabled={syncingContacts || contactsPending === 0}
                className="gap-2"
            >
                {syncingContacts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Users className="h-4 w-4" />
                )}
                Sync contacts {contactsPending > 0 ? `(${contactsPending})` : ""}
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAudio}
                disabled={syncingAudio || audioPending === 0}
                className="gap-2"
                title="Enqueue audio_transcript_queue and upload to S3 as WebP"
            >
                {syncingAudio ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Mic className="h-4 w-4" />
                )}
                Upload audio to S3 (WebP) {audioPending > 0 ? `(${audioPending})` : ""}
            </Button>
        </div>
    );
}
