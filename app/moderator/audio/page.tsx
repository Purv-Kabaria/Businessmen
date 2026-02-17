"use client";

import { useEffect, useState } from "react";
import { Loader2, Play, Pause, Phone, Mail, Building2, Tag, User, Calendar, FileAudio, Wand2 } from "lucide-react";
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
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
    const [transcribingId, setTranscribingId] = useState<string | null>(null);
    const [generatedTranscripts, setGeneratedTranscripts] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        fetchInteractions(currentPage);
    }, [currentPage]);

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
                const meta = result.meta;

                // Store generated transcript
                setGeneratedTranscripts(new Map(generatedTranscripts.set(interaction.id, transcript)));

                toast.success(
                    `Transcribed in ${meta.processingTime}ms (${meta.audioDuration}s audio)`,
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

    function handlePlayPause(interaction: AudioInteraction) {
        if (!interaction.audioUrl) {
            toast.error("Audio URL not available");
            return;
        }

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
            audio = new Audio(interaction.audioUrl);

            audio.onended = () => setPlayingId(null);
            audio.onerror = () => {
                toast.error("Failed to load audio");
                setPlayingId(null);
            };

            setAudioElements(new Map(audioElements.set(interaction.id, audio)));
        }

        if (playingId === interaction.id) {
            audio.pause();
            setPlayingId(null);
        } else {
            audio.play().catch((error) => {
                if (error.name === "NotAllowedError") {
                    toast.error("Browser blocked autoplay - User interaction required");
                } else {
                    toast.error("Failed to play audio");
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
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handlePlayPause(interaction)}
                                                variant={playingId === interaction.id ? "default" : "outline"}
                                                size="sm"
                                                disabled={!interaction.audioUrl}
                                            >
                                                {playingId === interaction.id ? (
                                                    <>
                                                        <Pause className="h-4 w-4 mr-2" />
                                                        Pause
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="h-4 w-4 mr-2" />
                                                        {!interaction.audioUrl ? "No Audio" : "Play"}
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

                                        {/* Transcript & AI Insights */}
                                        <div className="space-y-4">
                                            {displayTranscript && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                                            Transcript
                                                        </h3>
                                                        {generatedTranscript && (
                                                            <Badge variant="default" className="text-xs">
                                                                AI Generated
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <ScrollArea className="h-32 rounded-md border p-3 bg-background">
                                                        <p className="text-sm whitespace-pre-wrap">
                                                            {displayTranscript}
                                                        </p>
                                                    </ScrollArea>
                                                </div>
                                            )}

                                            {!displayTranscript && interaction.audioUrl && (
                                                <Alert>
                                                    <Wand2 className="h-4 w-4" />
                                                    <AlertDescription>
                                                        No transcript available. Click "Transcribe" to generate one using AI.
                                                    </AlertDescription>
                                                </Alert>
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
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
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
        </div>
    );
}
