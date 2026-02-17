"use client";

import { useEffect, useState } from "react";
import { Loader2, Play, Pause, Phone, Mail, Building2, Tag, User, Calendar, FileAudio } from "lucide-react";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export default function AudioReviewPage() {
    const [interactions, setInteractions] = useState<AudioInteraction[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

    useEffect(() => {
        fetchInteractions(currentPage);
    }, [currentPage]);

    async function fetchInteractions(page: number) {
        setLoading(true);
        try {
            const response = await fetch(`/api/interactions/audio?page=${page}&limit=20`);
            const result = await response.json();

            console.log("[Audio Page] API Response:", result);

            if (!response.ok) {
                throw new Error(result.error?.message || "Failed to fetch audio interactions");
            }

            console.log("[Audio Page] Interactions:", result.data.interactions);
            console.log("[Audio Page] First interaction audioUrl:", result.data.interactions[0]?.audioUrl);

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
        if (!interaction.audioUrl) {
            toast.error("Audio URL not available");
            return;
        }

        console.log("[Audio] Playing:", interaction.audioUrl);

        // Stop currently playing audio
        if (playingId && playingId !== interaction.id) {
            const currentAudio = audioElements.get(playingId);
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
        }

        // Get or create audio element
        let audio = audioElements.get(interaction.id);
        if (!audio) {
            console.log("[Audio] Creating new audio element");
            audio = new Audio(interaction.audioUrl);

            // Detailed event listeners for debugging
            audio.onloadstart = () => console.log("[Audio] Loading started...");
            audio.oncanplay = () => console.log("[Audio] Can play - ready to start");
            audio.onplay = () => console.log("[Audio] Playback started");
            audio.onended = () => {
                console.log("[Audio] Playback ended");
                setPlayingId(null);
            };
            audio.onerror = (e) => {
                console.error("[Audio] Error event:", e);
                console.error("[Audio] Error details:", {
                    code: audio.error?.code,
                    message: audio.error?.message,
                    url: interaction.audioUrl?.substring(0, 100)
                });

                // Detailed error messages
                const errorMessages: Record<number, string> = {
                    1: "Audio loading aborted",
                    2: "Network error loading audio - Check if MinIO is running and CORS is configured",
                    3: "Audio decoding failed - File may be corrupted",
                    4: "Audio format not supported by browser"
                };

                const errorMsg = audio.error?.code
                    ? errorMessages[audio.error.code] || "Unknown audio error"
                    : "Failed to load audio";

                toast.error(errorMsg);
                setPlayingId(null);
            };

            setAudioElements(new Map(audioElements.set(interaction.id, audio)));
        }

        if (playingId === interaction.id) {
            console.log("[Audio] Pausing");
            audio.pause();
            setPlayingId(null);
        } else {
            console.log("[Audio] Starting playback...");
            audio.play().catch((error) => {
                console.error("[Audio] Play error:", error);
                console.error("[Audio] Error name:", error.name);
                console.error("[Audio] Error message:", error.message);

                if (error.name === "NotAllowedError") {
                    toast.error("Browser blocked autoplay - User interaction required");
                } else if (error.name === "NotSupportedError") {
                    toast.error("Audio format not supported");
                } else {
                    toast.error("Failed to play audio - Check browser console for details");
                }
            });
            setPlayingId(interaction.id);
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
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Audio Review</h1>
                    <p className="text-muted-foreground mt-1">
                        Listen to recorded interactions and view contact details
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
                    {interactions.map((interaction) => (
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
                                    <div className="flex flex-col items-end gap-1">
                                        <Button
                                            onClick={() => handlePlayPause(interaction)}
                                            variant={playingId === interaction.id ? "default" : "outline"}
                                            size="sm"
                                            disabled={!interaction.audioUrl}
                                            title={!interaction.audioUrl ? "Audio URL not available" : ""}
                                        >
                                            {playingId === interaction.id ? (
                                                <>
                                                    <Pause className="h-4 w-4 mr-2" />
                                                    Pause
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="h-4 w-4 mr-2" />
                                                    {!interaction.audioUrl ? "No Audio" : "Play Audio"}
                                                </>
                                            )}
                                        </Button>
                                        {!interaction.audioUrl && (
                                            <span className="text-xs text-muted-foreground">
                                                Audio unavailable
                                            </span>
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

                                    {/* Transcript & AI Insights */}
                                    <div className="space-y-4">
                                        {interaction.transcript && (
                                            <div>
                                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                                                    Transcript
                                                </h3>
                                                <ScrollArea className="h-32 rounded-md border p-3">
                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                                        {interaction.transcript}
                                                    </p>
                                                </ScrollArea>
                                            </div>
                                        )}
                                        {interaction.structuredSnapshot && (
                                            <div>
                                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                                                    AI Insights
                                                </h3>
                                                <div className="rounded-md border p-3 bg-muted/30">
                                                    <pre className="text-xs overflow-auto">
                                                        {JSON.stringify(interaction.structuredSnapshot, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )
            }

            {/* Pagination */}
            {
                pagination && pagination.totalPages > 1 && (
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
                )
            }
        </div >
    );
}
