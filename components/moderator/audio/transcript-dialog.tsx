"use client";

import {
    FileText, Sparkles, Loader2, X
} from "lucide-react";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AudioInteraction } from "@/types/audio-review";

interface TranscriptDialogProps {
    isOpen: boolean;
    onClose: (open: boolean) => void;
    interaction: AudioInteraction | null;
    generatedTranscript: string | undefined;
    onSummarize: (interaction: AudioInteraction) => void;
    onSeek: (seconds: number) => void;
    isSummarizing: boolean;
    formatTime: (seconds: number | null) => string;
}

export function TranscriptDialog({
    isOpen,
    onClose,
    interaction,
    generatedTranscript,
    onSummarize,
    onSeek,
    isSummarizing,
    formatTime
}: TranscriptDialogProps) {
    if (!interaction) return null;

    const displayTranscript = generatedTranscript || interaction.transcript;
    const segments = interaction.structuredSnapshot?.segments;
    const summary = interaction.structuredSnapshot?.summary;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-lg gap-0" showCloseButton={false}>
                <DialogHeader className="p-4 sm:p-6 border-b bg-muted/20 relative">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8 sm:pr-10">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="text-lg font-semibold truncate leading-tight">
                                    Transcript
                                </DialogTitle>
                                <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-muted-foreground">
                                    <span className="text-primary truncate max-w-[120px] sm:max-w-none">{interaction.contact.name || "Unknown Professional"}</span>
                                    <span className="text-muted-foreground hidden sm:inline">•</span>
                                    <span className="text-muted-foreground">{format(new Date(interaction.createdAt), "MMM dd, yyyy")}</span>
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 sm:ml-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSummarize(interaction)}
                                disabled={isSummarizing || !displayTranscript}
                                className="h-8 text-xs"
                            >
                                {isSummarizing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                ) : (
                                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                {summary ? "Update summary" : "Summarize"}
                            </Button>
                        </div>
                    </div>
                    <DialogClose className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none [&_svg]:size-4">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8">
                    {/* AI Summary - scrollable when very long */}
                    {summary && (
                        <div className="space-y-2 min-h-0 flex flex-col">
                            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2 shrink-0">
                                <Sparkles className="h-3.5 w-3.5" />
                                Summary
                            </h4>
                            <div className="p-4 rounded-lg border bg-muted/20 text-sm leading-relaxed max-h-[min(30vh,220px)] overflow-y-auto overflow-x-hidden wrap-break-word">
                                {summary}
                            </div>
                        </div>
                    )}

                    {/* Full transcript */}
                    <div className="space-y-2 pb-4 min-h-0 flex flex-col">
                        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2 shrink-0">
                            <FileText className="h-3.5 w-3.5" />
                            Full transcript
                        </h4>
                        <div className="p-4 rounded-lg border bg-muted/5 text-sm leading-relaxed min-h-0 max-h-[min(50vh,400px)] overflow-y-auto overflow-x-hidden">
                            {segments ? (
                                <div className="flex flex-wrap gap-x-1 sm:gap-x-1.5 gap-y-2 sm:gap-y-3">
                                    {segments.map((seg: { text: string; start: number; end: number }, idx: number) => {
                                        const isHotspot = interaction.structuredSnapshot?.hotspots?.some((hs: { start?: number; end?: number }) =>
                                            typeof hs.start === "number" && Math.abs(hs.start - seg.start) < 0.1
                                        );

                                        return (
                                            <span
                                                key={idx}
                                                onClick={() => onSeek(seg.start)}
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
                                <p className="whitespace-pre-wrap text-sm sm:text-base wrap-break-word">{displayTranscript}</p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
