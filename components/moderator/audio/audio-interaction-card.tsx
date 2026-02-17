"use client";

import { format } from "date-fns";
import {
    Calendar, User, Phone, Building2, Mail, Tag,
    Play, Pause, Wand2, Loader2, FileText, ChevronRight, ListOrdered
} from "lucide-react";
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import { AudioInteraction } from "@/types/audio-review";
import { AudioAnalysisDashboard } from "./audio-analysis-dashboard";

interface AudioInteractionCardProps {
    interaction: AudioInteraction;
    onPlay: (interaction: AudioInteraction) => void;
    onTranscribe: (interaction: AudioInteraction) => void;
    onPlayToggle: (interaction: AudioInteraction, index: number) => void;
    onReviewTranscript: (interaction: AudioInteraction) => void;
    isPlaying: (interactionId: string) => boolean;
    isTranscribing: boolean;
    playingKey: string | null;
    selectedAudioIndex: number;
    setSelectedAudioIndex: (index: number) => void;
}

export function AudioInteractionCard({
    interaction,
    onPlay,
    onTranscribe,
    onPlayToggle,
    onReviewTranscript,
    isPlaying,
    isTranscribing,
    playingKey,
    selectedAudioIndex,
    setSelectedAudioIndex
}: AudioInteractionCardProps) {
    const displayTranscript = interaction.transcript;
    const isCurrentTrackPlaying = isPlaying(interaction.id);

    return (
        <Card className="overflow-hidden min-w-0 max-w-full">
            <CardHeader className="border-b bg-muted/30 py-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-medium">
                            {interaction.contact.name || "Unnamed contact"}
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
                                    value={selectedAudioIndex.toString()}
                                    onValueChange={(val) => setSelectedAudioIndex(parseInt(val))}
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
                                <span className="text-xs text-muted-foreground">Single audio</span>
                            )}

                            {(() => {
                                const key = `${interaction.id}-${selectedAudioIndex}`;
                                const isItemPlaying = playingKey === key;
                                const url = interaction.audioUrls[selectedAudioIndex];

                                return (
                                    <Button
  onClick={() => onPlayToggle(interaction, selectedAudioIndex)}
  size="sm"
  disabled={!url}
  variant="outline"
  className={`
    h-8 w-[90px] 
    text-xs
    border border-primary/40
    transition-colors duration-200
    focus:ring-0 focus-visible:ring-0
    hover:bg-primary/10
    ${isItemPlaying ? "bg-primary text-white" : ""}
  `}
>

                                        {isItemPlaying ? (
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
            <CardContent className="pt-6 min-w-0">
                <div className="grid md:grid-cols-2 gap-6 min-w-0">
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

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant={isCurrentTrackPlaying ? "secondary" : "default"}
                                size="sm"
                                onClick={() => onPlay(interaction)}
                                className="h-8 text-xs"
                            >
                                {isCurrentTrackPlaying ? (
                                    <><Pause className="h-3 w-3 mr-1.5" /> Pause</>
                                ) : (
                                    <><Play className="h-3 w-3 mr-1.5" /> Play</>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => onTranscribe(interaction)}
                                disabled={isTranscribing}
                            >
                                {isTranscribing ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                ) : (
                                    <Wand2 className="h-3 w-3 mr-1.5" />
                                )}
                                {displayTranscript ? "Retranscribe" : "Transcribe"}
                            </Button>
                            <Link href={`/moderator/contacts/${interaction.contact.id}/simulate`}>
                                <Button variant="outline" size="sm" className="h-8 text-xs">
                                    <ListOrdered className="h-3.5 w-3.5 mr-1.5" />
                                    Strategy
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4 mt-4">
                        {/* Contact Attributes */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-muted/30 p-3 sm:p-4 rounded-lg border">
                            <div className="space-y-0.5">
                                <span className="text-xs text-muted-foreground">Company</span>
                                <div className="flex items-center gap-1.5 text-sm truncate">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate">{interaction.contact.company || "—"}</span>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-xs text-muted-foreground">Phone</span>
                                <div className="flex items-center gap-1.5 text-sm truncate">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate">{interaction.contact.phone || "—"}</span>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-xs text-muted-foreground">Email</span>
                                <div className="flex items-center gap-1.5 text-sm truncate">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate">{interaction.contact.email || "—"}</span>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-xs text-muted-foreground">Agent</span>
                                <div className="flex items-center gap-1.5 text-sm truncate">
                                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate">{interaction.createdBy.fullName.split(' ')[0]}</span>
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex flex-col justify-center gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">Stage:</span>
                                <span className="text-sm font-medium">{interaction.contact.currentStage}</span>
                                {interaction.structuredSnapshot?.hotspots && interaction.structuredSnapshot.hotspots.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        · {interaction.structuredSnapshot.hotspots.length} highlight{interaction.structuredSnapshot.hotspots.length !== 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                            {interaction.contact.intentTags && Array.isArray(interaction.contact.intentTags) && interaction.contact.intentTags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {interaction.contact.intentTags.map((tag: string, i: number) => (
                                        <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {displayTranscript && (
                        <>
                            <div className="flex items-center justify-between py-2 border-t">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    <span>Transcript and analysis available</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => onReviewTranscript(interaction)}
                                >
                                    View transcript <ChevronRight className="h-3 w-3 ml-1" />
                                </Button>
                            </div>
                            <AudioAnalysisDashboard interaction={interaction} />
                        </>
                    )}

                    {!displayTranscript && interaction.audioUrls?.length > 0 && (
                        <div className="bg-muted/20 rounded-lg p-8 flex flex-col items-center justify-center text-center border border-dashed">
                            <Wand2 className="h-8 w-8 text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground">
                                Transcribe to see transcript and sentiment analysis.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card >
    );
}
