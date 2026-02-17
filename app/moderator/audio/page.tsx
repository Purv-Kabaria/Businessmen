"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Loader2, Search, X, ChevronLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Custom Components
import { AudioInteractionCard } from "@/components/moderator/audio/audio-interaction-card";
import { AudioPagination } from "@/components/moderator/audio/audio-pagination";
import { AudioPlayerSticky } from "@/components/moderator/audio/audio-player-sticky";
import { TranscriptDialog } from "@/components/moderator/audio/transcript-dialog";
import { ContactUpdateDialog } from "@/components/moderator/audio/contact-update-dialog";

// Types
import {
    AudioInteraction,
    PaginationInfo,
    TrackInfo
} from "@/types/audio-review";

const TRANSCRIBE_API_URL = process.env.NEXT_PUBLIC_TRANSCRIBE_API_URL || 'http://localhost:8000';

export default function AudioReviewPage() {
    const [interactions, setInteractions] = useState<AudioInteraction[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [playingKey, setPlayingKey] = useState<string | null>(null);
    const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [generatedTranscripts, setGeneratedTranscripts] = useState<Map<string, string>>(new Map());
    const [summarizingId, setSummarizingId] = useState<string | null>(null);
    const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [transcribingId, setTranscribingId] = useState<string | null>(null);
    const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
    const [selectedAudioIndices, setSelectedAudioIndices] = useState<Record<string, number>>({});
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    const [suggestedUpdate, setSuggestedUpdate] = useState<{
        interactionId: string;
        contactId: string;
        name: string | null;
        company: string | null;
        email: string | null;
    } | null>(null);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchInteractions(currentPage, debouncedSearch);
    }, [currentPage, debouncedSearch]);

    async function fetchInteractions(page: number, search: string = "") {
        setLoading(true);
        try {
            const limit = 3;
            const response = await fetch(`/api/interactions/audio?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error?.message || "Failed to fetch audio interactions");
            }

            setInteractions(result.data.interactions);
            setPagination(result.data.pagination);
        } catch (error: unknown) {
            console.error("Failed to fetch interactions:", error);
            toast.error(error instanceof Error ? error.message : "Failed to load audio interactions");
        } finally {
            setLoading(false);
        }
    }

    async function handleSummarize(interaction: AudioInteraction) {
        const transcript = generatedTranscripts.get(interaction.id) || interaction.transcript;

        if (!transcript) {
            toast.error("Please transcribe the audio first");
            return;
        }

        setSummarizingId(interaction.id);
        const toastId = toast.loading("Generating AI summary...");

        try {
            const response = await fetch(`${TRANSCRIBE_API_URL}/api/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcript,
                    model: "gemma3:4b"
                }),
            });

            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Summarization failed");

            // Update interaction list in state to include summary in structuredSnapshot
            const updatedSnapshot = {
                ...(interaction.structuredSnapshot || {}),
                summary: result.summary
            };

            setInteractions(prev => prev.map(item =>
                item.id === interaction.id
                    ? { ...item, structuredSnapshot: updatedSnapshot }
                    : item
            ));

            // Persist to DB
            await fetch('/api/interactions/audio', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    interactionId: interaction.id,
                    structuredSnapshot: updatedSnapshot
                })
            });

            toast.success("Summary generated!", { id: toastId });
        } catch (error: unknown) {
            console.error("[Summarize] Error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to summarize", { id: toastId });
        } finally {
            setSummarizingId(null);
        }
    }

    async function handleTranscribe(interaction: AudioInteraction) {
        const urls = interaction.audioUrls;
        if (!urls || urls.length === 0) {
            toast.error("No audio to transcribe");
            return;
        }

        setTranscribingId(interaction.id);
        const toastId = toast.loading(`Transcribing ${urls.length} audio file(s)...`);

        try {
            const transcriptParts: string[] = [];
            const allSegments: Array<{ text: string; start: number; end: number }> = [];
            const allHotspots: Array<{ start: number; end: number; [k: string]: unknown }> = [];
            let cumulativeOffsetSec = 0;
            let finalSnapshotData: Record<string, unknown> = { ...(interaction.structuredSnapshot as Record<string, unknown> || {}) };

            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                if (!url) continue;

                if (urls.length > 1) {
                    toast.loading(`Transcribing part ${i + 1} of ${urls.length}...`, { id: toastId });
                }

                const response = await fetch(`${TRANSCRIBE_API_URL}/api/transcribe-by-url`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ audio_url: url }),
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    console.error(`Failed to transcribe part ${i + 1}`, result);
                    transcriptParts.push(`[Audio Part ${i + 1}: Transcription Failed]`);
                    continue;
                }

                const data = result.data || {};
                const text = data.transcript || result.text || "";

                if (urls.length > 1) {
                    transcriptParts.push(`[Audio Part ${i + 1}]\n${text}`);
                } else {
                    transcriptParts.push(text);
                }

                // Capture ML Metadata
                if (data.sentiment) finalSnapshotData.sentiment = data.sentiment;
                if (data.emotions) finalSnapshotData.emotions = data.emotions;
                if (data.sentimentFlow) finalSnapshotData.sentimentFlow = data.sentimentFlow;
                if (data.voiceEmotion) finalSnapshotData.voiceEmotion = data.voiceEmotion;

                // Timestamp-based segments for sentence-level highlighting and seek
                const partSegments = Array.isArray(data.segments) ? data.segments : [];
                let partEndSec = cumulativeOffsetSec;
                for (const seg of partSegments) {
                    const start = typeof seg.start === "number" ? seg.start : 0;
                    const end = typeof seg.end === "number" ? seg.end : start;
                    const segText = typeof seg.text === "string" ? seg.text : String(seg?.text ?? "").trim();
                    if (segText) {
                        allSegments.push({
                            text: segText,
                            start: Math.round((cumulativeOffsetSec + start) * 100) / 100,
                            end: Math.round((cumulativeOffsetSec + end) * 100) / 100,
                        });
                        partEndSec = Math.max(partEndSec, cumulativeOffsetSec + end);
                    }
                }
                if (partSegments.length > 0) {
                    const last = partSegments[partSegments.length - 1];
                    partEndSec = cumulativeOffsetSec + (typeof last?.end === "number" ? last.end : 0);
                }
                const partHotspots = Array.isArray(data.hotspots) ? data.hotspots : [];
                for (const h of partHotspots) {
                    const start = typeof h.start === "number" ? h.start : 0;
                    const end = typeof h.end === "number" ? h.end : start;
                    allHotspots.push({
                        ...h,
                        start: Math.round((cumulativeOffsetSec + start) * 100) / 100,
                        end: Math.round((cumulativeOffsetSec + end) * 100) / 100,
                    });
                }
                cumulativeOffsetSec = partEndSec;

                // If the backend detected contact info updates in this audio
                if (data.suggested_contact_info) {
                    setSuggestedUpdate({
                        interactionId: interaction.id,
                        contactId: interaction.contact.id,
                        ...data.suggested_contact_info
                    });
                    setIsUpdateModalOpen(true);
                }
            }

            if (allSegments.length > 0) finalSnapshotData.segments = allSegments;
            if (allHotspots.length > 0) finalSnapshotData.hotspots = allHotspots;
            const fullTranscript = transcriptParts.join("\n\n");

            setGeneratedTranscripts((prev) => {
                const next = new Map(prev);
                next.set(interaction.id, fullTranscript);
                return next;
            });

            await fetch("/api/interactions/audio", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    interactionId: interaction.id,
                    transcript: fullTranscript,
                    structuredSnapshot: finalSnapshotData
                }),
            });

            setInteractions(prev => prev.map(item =>
                item.id === interaction.id
                    ? { ...item, transcript: fullTranscript, structuredSnapshot: finalSnapshotData }
                    : item
            ));

            toast.success("Transcription complete", { id: toastId });
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Transcription failed", { id: toastId });
        } finally {
            setTranscribingId(null);
        }
    }

    async function handleExportCSV() {
        setIsExporting(true);
        try {
            const response = await fetch('/api/interactions/export/csv');
            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success("CSV Downloaded successfully");
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Failed to download CSV");
        } finally {
            setIsExporting(false);
        }
    }

    async function handleUpdateContact() {
        if (!suggestedUpdate) return;

        const toastId = toast.loading("Updating contact details...");
        try {
            const interaction = interactions.find(i => i.id === suggestedUpdate.interactionId);
            if (!interaction) throw new Error("Interaction context lost");

            const response = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: interaction.contact.phone,
                    name: suggestedUpdate.name || undefined,
                    company: suggestedUpdate.company || undefined,
                    email: suggestedUpdate.email || undefined,
                })
            });

            if (!response.ok) throw new Error("Failed to update contact");

            toast.success("Contact details updated!", { id: toastId });
            setIsUpdateModalOpen(false);
            setSuggestedUpdate(null);

            fetchInteractions(currentPage, debouncedSearch);
        } catch (error: unknown) {
            console.error("Update error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to update contact", { id: toastId });
        }
    }

    // Audio Player Effects & Handlers
    useEffect(() => {
        if (currentTrack && audioRef.current) {
            setDuration(currentTrack.duration || null);
            audioRef.current.src = currentTrack.url;
            audioRef.current.load();
            audioRef.current.play().then(() => setIsPlaying(true)).catch(e => {
                console.log("Play failed", e);
            });
        }
    }, [currentTrack]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.play().catch(() => setIsPlaying(false));
            else audioRef.current.pause();
        }
    }, [isPlaying]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            if (audioRef.current.currentTime > 999999) {
                audioRef.current.currentTime = 0;
                return;
            }
            setProgress(audioRef.current.currentTime);
            const d = audioRef.current.duration;
            if (d && d !== Infinity) {
                setDuration(d);
            } else if (currentTrack?.duration) {
                setDuration(currentTrack.duration);
            } else {
                setDuration(null);
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            const d = audioRef.current.duration;
            if (d && d !== Infinity) {
                setDuration(d);
            } else {
                audioRef.current.currentTime = 1e101;
            }
        }
    };

    const formatTime = (seconds: number | null) => {
        if (seconds === null || seconds === Infinity || isNaN(seconds)) return "--:--";
        if (seconds < 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    function playTrack(interaction: AudioInteraction) {
        const index = selectedAudioIndices[interaction.id] || 0;
        const url = interaction.audioUrls?.[index] ?? null;
        if (!url) {
            toast.error("No audio available");
            return;
        }
        setCurrentTrack({
            id: interaction.id,
            url,
            title: interaction.contact.name || "Unnamed Contact",
            subtitle: `${new Date(interaction.createdAt).toLocaleDateString()} • Part ${index + 1}`,
            duration: undefined,
        });
    }

    function handlePlayToggle(interaction: AudioInteraction, index: number) {
        const key = `${interaction.id}-${index}`;
        const url = interaction.audioUrls[index];
        if (!url) {
            toast.error("Audio URL not available");
            return;
        }

        if (playingKey && playingKey !== key) {
            const currentAudio = audioElements.get(playingKey);
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
        }

        let audio = audioElements.get(key);
        if (!audio) {
            audio = new Audio(url);
            audio.onended = () => setPlayingKey(null);
            audio.onerror = () => {
                toast.error("Failed to load audio");
                setPlayingKey(null);
            };
            setAudioElements(new Map(audioElements.set(key, audio)));
        }

        if (playingKey === key) {
            audio.pause();
            setPlayingKey(null);
        } else {
            audio.play().catch(() => toast.error("Failed to play audio"));
            setPlayingKey(key);
        }
    }

    if (loading && interactions.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8 space-y-8 pb-32 relative">
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => { setIsPlaying(false); setProgress(0); }}
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={handleTimeUpdate}
                onProgress={handleTimeUpdate}
                className="hidden"
            />

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
                        <BreadcrumbLink asChild>
                            <Link href="/moderator">Moderator</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Audio review</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground shrink-0">
                        <Link href="/moderator">
                            <ChevronLeft className="h-4 w-4 mr-1" /> Back
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold">Audio review</h1>
                        <p className="text-sm text-muted-foreground">
                            {pagination?.total ?? 0} recording{(pagination?.total ?? 0) !== 1 ? "s" : ""} · Listen and transcribe.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={handleExportCSV}
                        disabled={isExporting}
                    >
                        {isExporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Download className="h-3.5 w-3.5" />
                        )}
                        Export CSV
                    </Button>
                    <div className="relative w-full sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            type="search"
                            placeholder="Search..."
                            className="h-8 pl-8 pr-8 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded p-0.5"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-6">
                {interactions.length === 0 ? (
                    <div className="bg-muted/20 border border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center">
                        <Search className="h-8 w-8 text-muted-foreground mb-4" />
                        <h3 className="text-base font-medium mb-1">No recordings found</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {searchQuery
                                ? "No results match your search."
                                : "Recordings will appear here once interactions are captured."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {interactions.map((interaction) => (
                            <AudioInteractionCard
                                key={interaction.id}
                                interaction={interaction}
                                onPlay={playTrack}
                                onTranscribe={handleTranscribe}
                                onPlayToggle={handlePlayToggle}
                                onReviewTranscript={(i) => {
                                    setActiveInteractionId(i.id);
                                    setIsTranscriptOpen(true);
                                }}
                                isPlaying={(id) => currentTrack?.id === id && isPlaying}
                                isTranscribing={transcribingId === interaction.id}
                                playingKey={playingKey}
                                selectedAudioIndex={selectedAudioIndices[interaction.id] || 0}
                                setSelectedAudioIndex={(idx) => setSelectedAudioIndices(prev => ({ ...prev, [interaction.id]: idx }))}
                            />
                        ))}
                    </div>
                )}
            </div>

            <AudioPagination
                pagination={pagination}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                loading={loading}
            />

            {currentTrack && (
                <AudioPlayerSticky
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    progress={progress}
                    duration={duration}
                    onSeek={(val) => {
                        if (audioRef.current) {
                            audioRef.current.currentTime = val;
                            setProgress(val);
                        }
                    }}
                    volume={volume}
                    onVolumeChange={setVolume}
                    isMuted={isMuted}
                    onToggleMute={() => setIsMuted(!isMuted)}
                    onClose={() => { setIsPlaying(false); setCurrentTrack(null); }}
                    formatTime={formatTime}
                    interactions={interactions}
                />
            )}

            <TranscriptDialog
                isOpen={isTranscriptOpen}
                onClose={setIsTranscriptOpen}
                interaction={interactions.find(i => i.id === activeInteractionId) || null}
                generatedTranscript={activeInteractionId ? generatedTranscripts.get(activeInteractionId) : undefined}
                onSummarize={handleSummarize}
                onPlay={playTrack}
                onSeek={(val) => {
                    if (currentTrack?.id === activeInteractionId && audioRef.current) {
                        audioRef.current.currentTime = val;
                        setProgress(val);
                    }
                }}
                isSummarizing={!!summarizingId}
                formatTime={formatTime}
            />

            <ContactUpdateDialog
                isOpen={isUpdateModalOpen}
                onClose={setIsUpdateModalOpen}
                suggestedUpdate={suggestedUpdate}
                setSuggestedUpdate={setSuggestedUpdate}
                onUpdate={handleUpdateContact}
            />
        </div>
    );
}
