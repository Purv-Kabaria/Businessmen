"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, Play, Pause, Phone, Mail, Building2, Tag, User, Calendar, FileAudio, Wand2, Volume2, VolumeX, SkipBack, SkipForward, X, Sparkles, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface Contact {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    company: string | null;
    currentStage: string;
    intentTags: any;
}

interface CreatedBy {
    id: string;
    fullName: string;
    email: string;
}

interface AudioInteraction {
    id: string;
    audioUrl: string | null;
    audioObjectKey: string | null;
    transcript: string | null;
    structuredSnapshot: any;
    tags: any;
    createdAt: string;
    contact: Contact;
    createdBy: CreatedBy;
}

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const TRANSCRIBE_API_URL = process.env.NEXT_PUBLIC_TRANSCRIBE_API_URL || 'http://localhost:8000';

export default function AudioReviewPage() {
    const [interactions, setInteractions] = useState<AudioInteraction[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    // Player State
    const [currentTrack, setCurrentTrack] = useState<{
        id: string;
        url: string;
        title: string;
        subtitle: string;
        duration?: number;
    } | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState<number | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [transcribingId, setTranscribingId] = useState<string | null>(null);
    const [summarizingId, setSummarizingId] = useState<string | null>(null);
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
    const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);
    const [generatedTranscripts, setGeneratedTranscripts] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        fetchInteractions(currentPage);
    }, [currentPage]);

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
            setInteractions(prev => prev.map(item =>
                item.id === interaction.id
                    ? {
                        ...item,
                        structuredSnapshot: {
                            ...(item.structuredSnapshot || {}),
                            summary: result.summary
                        }
                    }
                    : item
            ));

            // Persist to DB
            await fetch('/api/interactions/audio', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    interactionId: interaction.id,
                    structuredSnapshot: {
                        ...(interaction.structuredSnapshot || {}),
                        summary: result.summary
                    }
                })
            });

            toast.success("Summary generated!", { id: toastId });
        } catch (error: any) {
            console.error("[Summarize] Error:", error);
            toast.error(error.message || "Failed to summarize", { id: toastId });
        } finally {
            setSummarizingId(null);
        }
    }

    // Audio Player Effects
    useEffect(() => {
        if (currentTrack && audioRef.current) {
            // Immediately set duration if we have it in state (fallback)
            setDuration(currentTrack.duration || null);

            audioRef.current.src = currentTrack.url;
            audioRef.current.load(); // Force reset/load

            audioRef.current.play().then(() => setIsPlaying(true)).catch(e => {
                console.log("Play failed, probably needs user interaction first or track shift");
            });
        }
    }, [currentTrack]);

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            const d = audioRef.current.duration;
            console.log("[Audio] Metadata loaded. Duration:", d);

            if (d && d !== Infinity) {
                setDuration(d);
            } else {
                // Probe hack for webm: jump to far future to force duration calculation
                console.log("[Audio] Duration is Infinity/Unknown, performing probe...");
                audioRef.current.currentTime = 1e101;
            }
        }
    };

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
            // If we're performing the duration probe (jumping to end and back)
            if (audioRef.current.currentTime > 999999) {
                audioRef.current.currentTime = 0;
                return;
            }

            setProgress(audioRef.current.currentTime);
            // Handle Infinity which can happen with some stream types (like webm)
            const d = audioRef.current.duration;
            if (d && d !== Infinity) {
                setDuration(d);
            } else if (currentTrack?.duration) {
                // Use fallback from DB/Transcription if browser returns Infinity
                setDuration(currentTrack.duration);
            } else {
                setDuration(null);
            }
        }
    };

    const handleTrackEnded = () => {
        setIsPlaying(false);
        setProgress(0);
    };

    const formatTime = (seconds: number | null) => {
        if (seconds === null || seconds === Infinity || isNaN(seconds)) return "--:--";
        if (seconds < 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    async function fetchInteractions(page: number) {
        setLoading(true);
        try {
            const response = await fetch(`/api/interactions/audio?page=${page}&limit=20`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error?.message || "Failed to fetch audio interactions");
            }

            setInteractions(result.data.interactions);
            setPagination(result.data.pagination);
        } catch (error: any) {
            console.error("Failed to fetch interactions:", error);
            toast.error(error.message || "Failed to load audio interactions");
        } finally {
            setLoading(false);
        }
    }

    async function handleTranscribe(interaction: AudioInteraction) {
        if (!interaction.audioUrl) {
            toast.error("Audio URL not available");
            return;
        }

        setTranscribingId(interaction.id);
        const toastId = toast.loading("Downloading and transcribing audio...");

        try {
            console.log("[Transcribe] Fetching audio from:", interaction.audioUrl);

            // Download audio file
            const audioResponse = await fetch(interaction.audioUrl);
            if (!audioResponse.ok) {
                throw new Error("Failed to download audio file");
            }

            const audioBlob = await audioResponse.blob();
            console.log("[Transcribe] Audio blob size:", audioBlob.size, "bytes");

            // Send to transcription API
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            console.log("[Transcribe] Sending to API:", `${TRANSCRIBE_API_URL}/api/transcribe`);

            const transcribeResponse = await fetch(`${TRANSCRIBE_API_URL}/api/transcribe`, {
                method: 'POST',
                body: formData,
            });

            const result = await transcribeResponse.json();
            console.log("[Transcribe] API response:", result);

            if (!transcribeResponse.ok) {
                throw new Error(result.error || result.detail || "Transcription failed");
            }

            if (result.success && result.data?.transcript) {
                const transcript = result.data.transcript;
                const segments = result.data.segments;
                const audioDuration = result.meta.audioDuration;
                const meta = result.meta;

                // 1. Store locally for immediate UI update
                setGeneratedTranscripts(new Map(generatedTranscripts.set(interaction.id, transcript)));
                // Also update the interaction list in state to include structuredSnapshot
                setInteractions(prev => prev.map(item =>
                    item.id === interaction.id
                        ? {
                            ...item,
                            transcript,
                            structuredSnapshot: {
                                ...(item.structuredSnapshot || {}),
                                segments,
                                hotspots: result.data.hotspots,
                                audioDuration
                            }
                        }
                        : item
                ));

                // 2. Persist to DB
                try {
                    console.log("[Transcribe] Persisting to database with segments and duration...");
                    const saveResponse = await fetch('/api/interactions/audio', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            interactionId: interaction.id,
                            transcript: transcript,
                            structuredSnapshot: {
                                ...(interaction.structuredSnapshot || {}),
                                segments,
                                hotspots: result.data.hotspots,
                                audioDuration
                            }
                        })
                    });

                    if (!saveResponse.ok) {
                        console.warn("[Transcribe] DB persistence failed");
                    }
                } catch (dbError) {
                    console.error("[Transcribe] DB persistence error:", dbError);
                }

                toast.success(
                    `Transcribed in ${result.meta.processingTime}ms (${meta.audioDuration}s audio)`,
                    { id: toastId, duration: 5000 }
                );

                console.log("[Transcribe] Success:", {
                    transcript: transcript.substring(0, 100) + "...",
                    language: result.data.language,
                    meta
                });
            } else {
                throw new Error("Invalid response format");
            }

        } catch (error: any) {
            console.error("[Transcribe] Error:", error);
            toast.error(error.message || "Failed to transcribe audio", { id: toastId });
        } finally {
            setTranscribingId(null);
        }
    }

    function seekTo(time: number, interactionId: string) {
        // If this interaction isn't the current track, load it
        if (currentTrack?.id !== interactionId) {
            const interaction = interactions.find(i => i.id === interactionId);
            if (interaction && interaction.audioUrl) {
                setCurrentTrack({
                    id: interaction.id,
                    url: interaction.audioUrl,
                    title: interaction.contact.name || "Unknown Contact",
                    subtitle: format(new Date(interaction.createdAt), "MMM dd • h:mm a"),
                    duration: interaction.structuredSnapshot?.audioDuration,
                });
                setIsPlaying(true);
                // We need to wait for metadata to load before seeking
                // The effect will handle loading the src. 
                // We can use a small delay or better: a ref/signal
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.currentTime = time;
                        setIsPlaying(true);
                    }
                }, 500);
            }
        } else if (audioRef.current) {
            audioRef.current.currentTime = time;
            if (!isPlaying) setIsPlaying(true);
        }
    }

    // New Play Handler that sets the global track
    function playTrack(interaction: AudioInteraction) {
        if (!interaction.audioUrl) {
            toast.error("No audio URL available");
            return;
        }

        if (currentTrack?.id === interaction.id) {
            setIsPlaying(!isPlaying);
        } else {
            setCurrentTrack({
                id: interaction.id,
                url: interaction.audioUrl,
                title: interaction.contact.name || "Unknown Contact",
                subtitle: format(new Date(interaction.createdAt), "MMM dd • h:mm a"),
                duration: interaction.structuredSnapshot?.audioDuration,
            });
            setIsPlaying(true);
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
        <div className="container mx-auto py-6 space-y-6 pb-24 relative">
            {/* Added pb-24 for player space */}

            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleTrackEnded}
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={handleTimeUpdate}
                onProgress={handleTimeUpdate}
                className="hidden"
            />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Audio Review & Transcription</h1>
                    <p className="text-muted-foreground mt-1">
                        Listen to recordings and generate AI transcriptions
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <FileAudio className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                        {pagination?.total || 0} recordings
                    </span>
                </div>
            </div>

            <Separator />

            {interactions.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No audio recordings found</p>
                        <p className="text-sm text-muted-foreground">
                            Audio recordings will appear here once interactions are captured
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {interactions.map((interaction) => {
                        const generatedTranscript = generatedTranscripts.get(interaction.id);
                        const displayTranscript = generatedTranscript || interaction.transcript;
                        const isCurrent = currentTrack?.id === interaction.id;

                        return (
                            <Card key={interaction.id} className={`overflow-hidden transition-all ${isCurrent ? 'ring-2 ring-primary border-primary' : ''}`}>
                                <CardHeader className="bg-muted/50">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-xl flex items-center gap-2">
                                                {interaction.contact.name || "Unnamed Contact"}
                                                {isCurrent && isPlaying && (
                                                    <Badge variant="default" className="animate-pulse h-5 text-[10px] px-1.5">
                                                        PLAYING
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-4">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {format(new Date(interaction.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3.5 w-3.5" />
                                                    {interaction.createdBy.fullName}
                                                </span>
                                                {interaction.structuredSnapshot?.audioDuration && (
                                                    <span className="flex items-center gap-1 text-primary font-medium">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {formatTime(interaction.structuredSnapshot.audioDuration)}
                                                    </span>
                                                )}
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => playTrack(interaction)}
                                                variant={isCurrent && isPlaying ? "default" : "outline"}
                                                size="sm"
                                                disabled={!interaction.audioUrl}
                                            >
                                                {isCurrent && isPlaying ? (
                                                    <>
                                                        <Pause className="h-4 w-4 mr-2" />
                                                        Pause
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="h-4 w-4 mr-2" />
                                                        Play
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                onClick={() => handleTranscribe(interaction)}
                                                variant="secondary"
                                                size="sm"
                                                disabled={!interaction.audioUrl || transcribingId === interaction.id}
                                            >
                                                {transcribingId === interaction.id ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Transcribing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Wand2 className="h-4 w-4 mr-2" />
                                                        {generatedTranscript ? "Re-transcribe" : "Transcribe"}
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        {/* Contact Information */}
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                                Contact Details
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-mono text-sm">{interaction.contact.phone}</span>
                                                </div>
                                                {interaction.contact.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">{interaction.contact.email}</span>
                                                    </div>
                                                )}
                                                {interaction.contact.company && (
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">{interaction.contact.company}</span>
                                                    </div>
                                                )}
                                                <div className="pt-2">
                                                    <Badge variant="secondary">
                                                        {interaction.contact.currentStage}
                                                    </Badge>
                                                </div>
                                                {interaction.contact.intentTags &&
                                                    Array.isArray(interaction.contact.intentTags) &&
                                                    interaction.contact.intentTags.length > 0 && (
                                                        <div className="flex items-start gap-2">
                                                            <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                            <div className="flex flex-wrap gap-1">
                                                                {interaction.contact.intentTags.map((tag: string, idx: number) => (
                                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {displayTranscript && (
                                                <div className="flex flex-col gap-3">
                                                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                                        <FileText className="h-4 w-4" />
                                                        AI Content
                                                    </h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            variant="default"
                                                            size="sm"
                                                            className="flex-1 md:flex-none"
                                                            onClick={() => {
                                                                setActiveInteractionId(interaction.id);
                                                                setIsTranscriptOpen(true);
                                                            }}
                                                        >
                                                            <FileText className="h-4 w-4 mr-2" />
                                                            View Full Transcript
                                                        </Button>

                                                        {interaction.structuredSnapshot?.summary && (
                                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-3 py-1">
                                                                <Sparkles className="h-3 w-3 mr-1.5" />
                                                                Summary Available
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {!displayTranscript && interaction.audioUrl && (
                                                <div className="bg-muted/30 rounded-lg p-6 flex flex-col items-center justify-center text-center border-2 border-dashed border-muted">
                                                    <Wand2 className="h-8 w-8 text-muted-foreground mb-3" />
                                                    <p className="text-sm text-muted-foreground max-w-[200px]">
                                                        No transcript available. Click "Transcribe" above to generate one.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || loading}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={currentPage === pagination.totalPages || loading}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* TRANSCRIPT DIALOG */}
            <Dialog open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    {(() => {
                        const activeInteraction = interactions.find(i => i.id === activeInteractionId);
                        if (!activeInteraction) return null;

                        const generatedTranscript = generatedTranscripts.get(activeInteraction.id);
                        const displayTranscript = generatedTranscript || activeInteraction.transcript;
                        const segments = activeInteraction.structuredSnapshot?.segments;
                        const summary = activeInteraction.structuredSnapshot?.summary;

                        return (
                            <>
                                <DialogHeader className="p-6 pb-2 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <DialogTitle className="text-xl">
                                                Transcript: {activeInteraction.contact.name || "Unknown"}
                                            </DialogTitle>
                                            <DialogDescription>
                                                Recording from {format(new Date(activeInteraction.createdAt), "MMMM dd, yyyy")}
                                            </DialogDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSummarize(activeInteraction)}
                                                disabled={summarizingId === activeInteraction.id || !displayTranscript}
                                            >
                                                {summarizingId === activeInteraction.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                                                )}
                                                {summary ? "Regenerate Summary" : "Summarize"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => playTrack(activeInteraction)}
                                            >
                                                <Play className="h-4 w-4 mr-2" />
                                                Play Original
                                            </Button>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* AI Summary in Dialog */}
                                    {summary && (
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-amber-600 flex items-center gap-2">
                                                <Sparkles className="h-4 w-4" />
                                                Executive Summary
                                            </h4>
                                            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-50/20 dark:bg-amber-950/20 italic text-foreground/90 leading-relaxed shadow-sm">
                                                {summary}
                                            </div>
                                        </div>
                                    )}

                                    {/* Full Transcript */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Full Transcription
                                        </h4>
                                        <div className="p-4 rounded-xl border bg-muted/10 leading-relaxed">
                                            {segments ? (
                                                <div className="space-y-2">
                                                    {segments.map((seg: any, idx: number) => {
                                                        const isHotspot = activeInteraction.structuredSnapshot?.hotspots?.some((hs: any) =>
                                                            Math.abs(hs.start - seg.start) < 0.1
                                                        );

                                                        return (
                                                            <span
                                                                key={idx}
                                                                onClick={() => {
                                                                    seekTo(seg.start, activeInteraction.id);
                                                                }}
                                                                className={`inline-block px-1.5 py-0.5 rounded cursor-pointer transition-all duration-200 
                                                                    ${isHotspot
                                                                        ? "bg-yellow-400/20 dark:bg-yellow-500/10 text-foreground border-b-2 border-yellow-400/50 shadow-sm font-medium"
                                                                        : "hover:bg-primary/10 hover:text-primary border-b border-transparent hover:border-primary/20"
                                                                    }`}
                                                                title={isHotspot ? "Key Business Information" : `Jump to ${formatTime(seg.start)}`}
                                                            >
                                                                {isHotspot && <Sparkles className="h-3 w-3 inline mr-1 text-yellow-600 dark:text-yellow-400" />}
                                                                {seg.text}{" "}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="whitespace-pre-wrap">{displayTranscript}</p>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* STICKY AUDIO PLAYER */}
            {currentTrack && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t shadow-lg animate-in slide-in-from-bottom duration-300">
                    <div className="container mx-auto h-20 flex items-center gap-6 px-4">

                        {/* Track Info */}
                        <div className="min-w-[180px] w-[25%]">
                            <h4 className="font-medium text-sm truncate">{currentTrack.title}</h4>
                            <p className="text-xs text-muted-foreground truncate">{currentTrack.subtitle}</p>
                        </div>

                        {/* Controls & Progress */}
                        <div className="flex-1 max-w-2xl flex flex-col items-center gap-2">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 10 }}>
                                    <SkipBack className="h-4 w-4" />
                                </Button>

                                <Button
                                    className="h-10 w-10 rounded-full shadow-md"
                                    onClick={() => setIsPlaying(!isPlaying)}
                                >
                                    {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current pl-0.5" />}
                                </Button>

                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { if (audioRef.current) audioRef.current.currentTime += 10 }}>
                                    <SkipForward className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="w-full flex items-center gap-2 text-xs font-medium tabular-nums text-muted-foreground">
                                <span>{formatTime(progress)}</span>
                                <div className="relative flex-1 h-6 flex items-center">
                                    {/* Hotspot Markers Overlay */}
                                    {duration && interactions.find(i => i.id === currentTrack.id)?.structuredSnapshot?.hotspots?.map((hs: any, idx: number) => {
                                        const left = (hs.start / duration) * 100;
                                        const width = ((hs.end - hs.start) / duration) * 100;
                                        return (
                                            <div
                                                key={idx}
                                                className="absolute h-2.5 bg-yellow-400/80 dark:bg-yellow-500/70 rounded-sm z-0 pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.4)]"
                                                style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%` }}
                                                title="Key Business Information"
                                            />
                                        );
                                    })}

                                    <Slider
                                        value={[progress]}
                                        max={duration || 100}
                                        step={0.1}
                                        onValueChange={(vals) => {
                                            if (audioRef.current) {
                                                audioRef.current.currentTime = vals[0];
                                                setProgress(vals[0]);
                                            }
                                        }}
                                        className="relative z-10 flex-1 cursor-pointer"
                                    />
                                </div>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Volume & Close */}
                        <div className="min-w-[180px] w-[25%] flex items-center justify-end gap-3">
                            <div className="flex items-center gap-2 w-32">
                                <button onClick={() => setIsMuted(!isMuted)} className="text-muted-foreground hover:text-foreground transition-colors">
                                    {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                </button>
                                <Slider
                                    value={[isMuted ? 0 : volume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={(vals) => setVolume(vals[0])}
                                    className="w-20"
                                />
                            </div>
                            <Separator orientation="vertical" className="h-8 mx-2" />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsPlaying(false); setCurrentTrack(null); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
