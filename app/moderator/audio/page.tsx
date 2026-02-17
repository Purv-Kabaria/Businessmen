"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Loader2, Play, Pause, Phone, Mail, Building2, Tag, User, Calendar, FileAudio, Wand2, Volume2, VolumeX, SkipBack, SkipForward, X, Sparkles, FileText, Clock, Search, ChevronLeft, ChevronRight, Download, Check, LayoutDashboard } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    audioUrls: (string | null)[];
    audioObjectKeys: string[];
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

type TrackInfo = { id: string; url: string; title: string; subtitle: string; duration?: number };

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
        } catch (error: any) {
            console.error("Failed to fetch interactions:", error);
            toast.error(error.message || "Failed to load audio interactions");
        } finally {
            setLoading(false);
        }
    }

    function handlePlayPause(interaction: AudioInteraction) {
        const index = selectedAudioIndices[interaction.id] || 0;
        const url = interaction.audioUrls[index];
        if (!url) {
            toast.error("Audio URL not available");
            return;
        }

        const key = `${interaction.id}-${index}`;

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
            audio.play().catch((error) => {
                if (error.name === "NotAllowedError") toast.error("Browser blocked autoplay");
                else toast.error("Failed to play audio");
            });
            setPlayingKey(key);
        }
    }

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
            subtitle: `${format(new Date(interaction.createdAt), "MMM dd, yyyy")} • Part ${index + 1}`,
            duration: undefined,
        });
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

            // Process all audios sequentially
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                if (!url) continue;

                // Update toast to show progress if multiple
                if (urls.length > 1) {
                    toast.loading(`Transcribing part ${i + 1} of ${urls.length}...`, { id: toastId });
                }

                const response = await fetch(`${TRANSCRIBE_API_URL}/api/transcribe`, {
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

                const text = result.text || "";
                if (urls.length > 1) {
                    transcriptParts.push(`[Audio Part ${i + 1}]\n${text}`);
                } else {
                    transcriptParts.push(text);
                }
            }

            const fullTranscript = transcriptParts.join("\n\n");

            setGeneratedTranscripts((prev) => {
                const next = new Map(prev);
                next.set(interaction.id, fullTranscript);
                return next;
            });

            await fetch("/api/interactions/audio", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ interactionId: interaction.id, transcript: fullTranscript }),
            });

            toast.success("Transcription complete", { id: toastId });
        } catch (e: any) {
            toast.error(e.message || "Transcription failed", { id: toastId });
        } finally {
            setTranscribingId(null);
        }
    }

    function seekTo(seconds: number, interactionId: string) {
        if (currentTrack?.id === interactionId && audioRef.current) {
            audioRef.current.currentTime = seconds;
            setProgress(seconds);
        }
    }

    const [isExporting, setIsExporting] = useState(false);

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

            // Refresh UI
            fetchInteractions(currentPage, debouncedSearch);
        } catch (error: any) {
            console.error("Update error:", error);
            toast.error(error.message || "Failed to update contact", { id: toastId });
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
        <div className="container mx-auto py-12 space-y-12 pb-32 relative">
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleTrackEnded}
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={handleTimeUpdate}
                onProgress={handleTimeUpdate}
                className="hidden"
            />

            {/* HEADER & SEARCH SECTION */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                <div className="space-y-4 sm:space-y-0">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 sm:mb-3">Audio Review</h1>
                    <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold ring-1 ring-primary/20">
                            <FileAudio className="h-3.5 w-3.5" />
                            {pagination?.total || 0} Recordings
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportCSV}
                            disabled={isExporting}
                            className="h-7 text-[10px] font-bold uppercase tracking-wider rounded-full border-primary/20 hover:bg-primary/5 transition-all shadow-sm"
                        >
                            {isExporting ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            ) : (
                                <Download className="h-3 w-3 mr-1.5 text-primary" />
                            )}
                            Export CSV
                        </Button>
                        <p className="text-xs sm:text-sm hidden sm:inline-block">Manage and transcribe interaction data.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row xl:items-center gap-3 sm:gap-4">
                    <Link href="/admin/dashboard">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-11 shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-xl border-primary/20 hover:bg-primary/5 transition-all shadow-sm gap-1.5 px-4"
                        >
                            <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
                            Admin Dashboard
                        </Button>
                    </Link>
                    <div className="relative w-full sm:w-72 lg:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Find contacts, companies..."
                            className="pl-10 h-11 bg-background shadow-sm border-muted-foreground/10 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-full transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between sm:justify-start gap-1 border bg-background/50 backdrop-blur-sm p-1.5 rounded-xl shadow-sm self-stretch sm:self-auto">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="px-3 text-[10px] font-black tabular-nums uppercase tracking-widest text-muted-foreground">
                                {currentPage} <span className="mx-1">/</span> {pagination.totalPages}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                disabled={currentPage === pagination.totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <Separator className="opacity-50" />

            {/* MAIN CONTENT LIST */}
            <div className="grid grid-cols-1 gap-6">
                {interactions.length === 0 ? (
                    <div className="bg-muted/20 border-2 border-dashed rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                        <div className="bg-background p-6 rounded-full shadow-sm mb-6">
                            <Search className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">No recordings found</h3>
                        <p className="text-muted-foreground max-w-sm">
                            {searchQuery
                                ? "We couldn't find anything matching your search. Try different keywords."
                                : "Audio recordings will appear here once interactions are captured at the expo."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {interactions.map((interaction) => {
                            const displayTranscript = generatedTranscripts.get(interaction.id) || interaction.transcript;
                            const isCurrent = currentTrack?.id === interaction.id;
                            return (
                                <Card key={interaction.id} className="overflow-hidden">
                                    <CardHeader className="bg-muted/50">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-xl">
                                                    {interaction.contact.name || "Unnamed Contact"}
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
                                                </CardDescription>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex items-center gap-2">
                                                    {interaction.audioUrls.length > 1 ? (
                                                        <Select
                                                            value={(selectedAudioIndices[interaction.id] || 0).toString()}
                                                            onValueChange={(val) => setSelectedAudioIndices(prev => ({ ...prev, [interaction.id]: parseInt(val) }))}
                                                        >
                                                            <SelectTrigger className="h-8 w-[140px] text-xs font-bold bg-background border-primary/20">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {interaction.audioUrls.map((_, idx) => (
                                                                    <SelectItem key={idx} value={idx.toString()} className="text-xs font-medium">
                                                                        Audio Part {idx + 1}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Badge variant="outline" className="h-8 px-3 text-[10px] font-black uppercase tracking-wider bg-background">
                                                            Single Audio
                                                        </Badge>
                                                    )}

                                                    {(() => {
                                                        const idx = selectedAudioIndices[interaction.id] || 0;
                                                        const key = `${interaction.id}-${idx}`;
                                                        const isPlaying = playingKey === key;
                                                        const url = interaction.audioUrls[idx];

                                                        return (
                                                            <Button
                                                                key={key}
                                                                onClick={() => handlePlayPause(interaction)}
                                                                variant={isPlaying ? "default" : "outline"}
                                                                size="sm"
                                                                disabled={!url}
                                                                className="h-8 px-4 text-xs font-bold rounded-lg transition-all"
                                                            >
                                                                {isPlaying ? (
                                                                    <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pause</>
                                                                ) : (
                                                                    <><Play className="h-3.5 w-3.5 mr-1.5" /> Play</>
                                                                )}
                                                            </Button>
                                                        );
                                                    })()}
                                                </div>

                                                {interaction.audioUrls.length === 0 && (
                                                    <span className="text-xs text-muted-foreground mr-1">No audio files found</span>
                                                )}
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
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 rounded-full shadow-sm text-[10px] font-bold transition-all hover:bg-primary/5"
                                                        onClick={() => handleTranscribe(interaction)}
                                                        disabled={transcribingId === interaction.id}
                                                    >
                                                        {transcribingId === interaction.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                                        ) : (
                                                            <Wand2 className="h-3 w-3 mr-1.5 text-primary" />
                                                        )}
                                                        {displayTranscript ? "Retranscribe All" : "Transcribe All"}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 mt-6">
                                                {/* Contact Details */}
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 bg-muted/30 p-3 sm:p-4 rounded-xl ring-1 ring-border/50">
                                                    <div className="space-y-0.5">
                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Company</span>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                                                            <Building2 className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                                            <span className="truncate">{interaction.contact.company || "Not specified"}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Phone</span>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                                                            <Phone className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                                            <span className="truncate">{interaction.contact.phone || "No phone"}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Email</span>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                                                            <Mail className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                                            <span className="truncate">{interaction.contact.email || "No email"}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Agent</span>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                                                            <User className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                                            <span className="truncate">{interaction.createdBy.fullName.split(' ')[0]}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Status & Highlights */}
                                                <div className="flex flex-col justify-center gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-2 py-0 text-[10px] font-black">
                                                            <Tag className="h-2.5 w-2.5 mr-1" />
                                                            {interaction.contact.currentStage}
                                                        </Badge>
                                                        {interaction.structuredSnapshot?.hotspots && interaction.structuredSnapshot.hotspots.length > 0 && (
                                                            <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 px-2 py-0 text-[10px] font-black">
                                                                <Sparkles className="h-2.5 w-2.5 mr-1" />
                                                                {interaction.structuredSnapshot.hotspots.length} BI
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {interaction.contact.intentTags && (
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {Array.isArray(interaction.contact.intentTags) ? interaction.contact.intentTags.map((tag: string, i: number) => (
                                                                <span key={i} className="text-[9px] bg-muted px-1.5 py-0 rounded-md font-bold text-muted-foreground uppercase tracking-wider border">#{tag}</span>
                                                            )) : null}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {displayTranscript && (
                                                <div className="p-1 rounded-2xl bg-linear-to-r from-primary/5 via-background to-primary/5 border shadow-sm">
                                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                                                <FileText className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-black uppercase tracking-tight">Intelligence Ready</p>
                                                                <p className="text-[9px] text-muted-foreground font-bold opacity-60">AI processed this interaction.</p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 rounded-lg font-black text-[10px] hover:bg-primary/10 hover:text-primary transition-all px-3"
                                                            onClick={() => {
                                                                setActiveInteractionId(interaction.id);
                                                                setIsTranscriptOpen(true);
                                                            }}
                                                        >
                                                            Review <ChevronRight className="h-3 w-3 ml-1" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {!displayTranscript && interaction.audioUrls?.length > 0 && (
                                                <div className="bg-muted/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center border-2 border-dashed border-muted/50">
                                                    <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                                                        <Wand2 className="h-6 w-6 text-primary animate-pulse" />
                                                    </div>
                                                    <h4 className="text-xs font-black uppercase tracking-tight mb-0.5 text-muted-foreground">Analysis Needed</h4>
                                                    <p className="text-[10px] text-muted-foreground/60 max-w-[200px] leading-tight">
                                                        Click transcribe to unlock insights.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card >
                            );
                        })
                        }
                    </div >
                )}
            </div >

            {/* LOWER PAGINATION */}
            {
                !loading && pagination && pagination.totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="rounded-xl px-4 h-10 font-bold text-xs"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1.5" /> Prev
                            </Button>

                            <div className="flex items-center gap-1.5">
                                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - currentPage) <= 1)
                                    .map((p, i, arr) => (
                                        <div key={p} className="flex items-center gap-1.5">
                                            {i > 0 && arr[i - 1] !== p - 1 && <span className="text-muted-foreground font-black px-1 opacity-50">.</span>}
                                            <Button
                                                variant={currentPage === p ? "default" : "outline"}
                                                size="icon"
                                                className={`h-10 w-10 rounded-xl font-black text-xs transition-all ${currentPage === p ? 'shadow-lg shadow-primary/25' : ''}`}
                                                onClick={() => setCurrentPage(p)}
                                            >
                                                {p}
                                            </Button>
                                        </div>
                                    ))
                                }
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === pagination.totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="rounded-xl px-4 h-10 font-bold text-xs"
                            >
                                Next <ChevronRight className="h-4 w-4 ml-1.5" />
                            </Button>
                        </div>
                    </div>
                )
            }

            {/* SMART CONTACT UPDATE DIALOG */}
            <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
                <DialogContent className="max-w-md w-[95vw] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 sm:p-8 border-b bg-primary/5">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                <Sparkles className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black italic">Smart Suggestion</DialogTitle>
                                <DialogDescription className="font-bold text-xs opacity-70 underline decoration-primary/30 decoration-2 underline-offset-4">
                                    AI detected updated contact info in the transcript
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 sm:p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                                <Input
                                    value={suggestedUpdate?.name || ""}
                                    onChange={(e) => setSuggestedUpdate(prev => prev ? { ...prev, name: e.target.value } : null)}
                                    className="h-12 rounded-xl bg-muted/30 border-none font-bold focus:ring-2 focus:ring-primary/20"
                                    placeholder="Not identified"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Company</label>
                                <Input
                                    value={suggestedUpdate?.company || ""}
                                    onChange={(e) => setSuggestedUpdate(prev => prev ? { ...prev, company: e.target.value } : null)}
                                    className="h-12 rounded-xl bg-muted/30 border-none font-bold focus:ring-2 focus:ring-primary/20"
                                    placeholder="Not identified"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                                <Input
                                    value={suggestedUpdate?.email || ""}
                                    onChange={(e) => setSuggestedUpdate(prev => prev ? { ...prev, email: e.target.value } : null)}
                                    className="h-12 rounded-xl bg-muted/30 border-none font-bold focus:ring-2 focus:ring-primary/20"
                                    placeholder="Not identified"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <Button
                                onClick={handleUpdateContact}
                                className="w-full h-12 rounded-xl font-black text-sm shadow-lg shadow-primary/20"
                            >
                                <Check className="h-4 w-4 mr-2" />
                                Update Contact Profile
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setIsUpdateModalOpen(false)}
                                className="w-full h-10 rounded-xl font-bold text-xs text-muted-foreground hover:bg-muted/50"
                            >
                                Not now
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* TRANSCRIPT DIALOG */}
            <Dialog open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-3xl border-none shadow-2xl gap-0">
                    {(() => {
                        const activeInteraction = interactions.find(i => i.id === activeInteractionId);
                        if (!activeInteraction) return null;

                        const generatedTranscript = generatedTranscripts.get(activeInteraction.id);
                        const displayTranscript = generatedTranscript || activeInteraction.transcript;
                        const segments = activeInteraction.structuredSnapshot?.segments;
                        const summary = activeInteraction.structuredSnapshot?.summary;

                        return (
                            <>
                                <DialogHeader className="p-4 sm:p-8 pb-4 sm:pb-6 border-b bg-muted/20 relative">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                                                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <DialogTitle className="text-lg sm:text-2xl font-black truncate leading-tight">
                                                    Interaction Intelligence
                                                </DialogTitle>
                                                <DialogDescription className="font-bold flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-sm">
                                                    <span className="text-primary truncate max-w-[120px] sm:max-w-none">{activeInteraction.contact.name || "Unknown Professional"}</span>
                                                    <span className="text-muted-foreground hidden sm:inline">•</span>
                                                    <span className="text-muted-foreground">{format(new Date(activeInteraction.createdAt), "MMM dd, yyyy")}</span>
                                                </DialogDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3 sm:ml-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSummarize(activeInteraction)}
                                                disabled={summarizingId === activeInteraction.id || !displayTranscript}
                                                className="rounded-xl font-bold shadow-sm h-9 sm:h-10 text-[10px] sm:text-xs"
                                            >
                                                {summarizingId === activeInteraction.id ? (
                                                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1.5 sm:mr-2" />
                                                ) : (
                                                    <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-amber-500" />
                                                )}
                                                <span className="hidden xs:inline">{summary ? "Update Summary" : "Generate Summary"}</span>
                                                <span className="xs:hidden">{summary ? "Update" : "Summarize"}</span>
                                            </Button>
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => playTrack(activeInteraction)}
                                                className="rounded-xl font-bold shadow-lg h-9 sm:h-10 text-[10px] sm:text-xs px-3 sm:px-4"
                                            >
                                                <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 fill-current" />
                                                Play
                                            </Button>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8">
                                    {/* AI Summary in Dialog */}
                                    {summary && (
                                        <div className="space-y-3 sm:space-y-4">
                                            <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2">
                                                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                                                Executive Insight
                                            </h4>
                                            <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-amber-500/10 bg-amber-500/5 italic text-base sm:text-lg leading-relaxed shadow-inner">
                                                "{summary}"
                                            </div>
                                        </div>
                                    )}

                                    {/* Full Transcript */}
                                    <div className="space-y-3 sm:space-y-4 pb-4">
                                        <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                                            Live Transcription
                                        </h4>
                                        <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border bg-muted/5 leading-loose text-base sm:text-lg">
                                            {segments ? (
                                                <div className="flex flex-wrap gap-x-1 sm:gap-x-1.5 gap-y-2 sm:gap-y-3">
                                                    {segments.map((seg: any, idx: number) => {
                                                        const isHotspot = activeInteraction.structuredSnapshot?.hotspots?.some((hs: any) =>
                                                            Math.abs(hs.start - seg.start) < 0.1
                                                        );

                                                        return (
                                                            <span
                                                                key={idx}
                                                                onClick={() => seekTo(seg.start, activeInteraction.id)}
                                                                className={`inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl cursor-pointer transition-all duration-300 
                                                                    ${isHotspot
                                                                        ? "bg-yellow-400/20 dark:bg-yellow-500/10 text-foreground ring-1 ring-yellow-400/50 shadow-md font-bold scale-[1.02] -rotate-1"
                                                                        : "hover:bg-primary/5 hover:text-primary"
                                                                    }`}
                                                                title={isHotspot ? "Critical Business Info" : `Jump to ${formatTime(seg.start)}`}
                                                            >
                                                                {isHotspot && <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 inline mr-1.5 sm:mr-2 text-yellow-600 dark:text-yellow-400" />}
                                                                {seg.text}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="whitespace-pre-wrap text-sm sm:text-base">{displayTranscript}</p>
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
            {
                currentTrack && (
                    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-3 sm:px-4 animate-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-background/95 backdrop-blur-xl border shadow-2xl rounded-3xl p-3 sm:p-4 flex items-center gap-4 sm:gap-8 border-primary/20">
                            {/* Track Info */}
                            <div className="min-w-0 max-w-[120px] sm:max-w-[200px] hidden xs:block">
                                <h4 className="font-black text-xs sm:text-sm truncate uppercase tracking-tight">{currentTrack.title}</h4>
                                <p className="text-[9px] sm:text-[10px] text-muted-foreground font-bold truncate opacity-60">{currentTrack.subtitle}</p>
                            </div>

                            {/* Controls & Progress */}
                            <div className="flex-1 flex flex-col items-center gap-1.5">
                                <div className="flex items-center gap-6">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-full" onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 10 }}>
                                        <SkipBack className="h-5 w-5" />
                                    </Button>

                                    <Button
                                        className="h-12 w-12 rounded-full shadow-2xl bg-primary hover:scale-110 active:scale-95 transition-all"
                                        onClick={() => setIsPlaying(!isPlaying)}
                                    >
                                        {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current pl-1" />}
                                    </Button>

                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-full" onClick={() => { if (audioRef.current) audioRef.current.currentTime += 10 }}>
                                        <SkipForward className="h-5 w-5" />
                                    </Button>
                                </div>

                                <div className="w-full flex items-center gap-3 text-[10px] font-black tabular-nums text-muted-foreground">
                                    <span className="w-8">{formatTime(progress)}</span>
                                    <div className="relative flex-1 h-6 flex items-center">
                                        {/* Hotspot Markers Overlay */}
                                        {duration && interactions.find(i => i.id === currentTrack.id)?.structuredSnapshot?.hotspots?.map((hs: any, idx: number) => {
                                            const left = (hs.start / duration) * 100;
                                            const width = ((hs.end - hs.start) / duration) * 100;
                                            return (
                                                <div
                                                    key={idx}
                                                    className="absolute h-3 bg-yellow-400/80 rounded-full z-0 shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                                                    style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%` }}
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
                                            className="relative z-10 flex-1"
                                        />
                                    </div>
                                    <span className="w-8 text-right">{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Volume & Close */}
                            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                                <div className="hidden lg:flex items-center gap-2 group">
                                    <button onClick={() => setIsMuted(!isMuted)} className="text-muted-foreground hover:text-primary transition-colors">
                                        {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                    </button>
                                    <Slider
                                        value={[isMuted ? 0 : volume]}
                                        max={1}
                                        step={0.01}
                                        onValueChange={(vals) => setVolume(vals[0])}
                                        className="w-20 hidden group-hover:block animate-in fade-in slide-in-from-right-2"
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-destructive rounded-full hover:bg-destructive/10"
                                    onClick={() => { setIsPlaying(false); setCurrentTrack(null); }}
                                >
                                    <X className="h-5 w-5 sm:h-6 sm:w-6" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
