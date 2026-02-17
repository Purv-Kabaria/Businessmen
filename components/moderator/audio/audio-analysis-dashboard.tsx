"use client";

import { useState } from "react";
import { Activity, Smile, Frown, Meh, Mic2, TrendingUp, FileText, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AudioInteraction } from "@/types/audio-review";

interface AudioAnalysisDashboardProps {
    interaction: AudioInteraction;
}

export function AudioAnalysisDashboard({ interaction }: AudioAnalysisDashboardProps) {
    const snapshot = interaction.structuredSnapshot;
    const hasBusiness = Boolean(
        (typeof snapshot?.summary === "string" && snapshot.summary.trim()) ||
        (Array.isArray(snapshot?.hotspots) && snapshot.hotspots.length > 0)
    );
    const hasSentiment = Boolean(snapshot?.sentiment);

    if (!hasBusiness && !hasSentiment) return null;

    const [sentimentExpanded, setSentimentExpanded] = useState(false);
    const summary = typeof snapshot?.summary === "string" ? snapshot.summary.trim() : "";
    const hotspots = Array.isArray(snapshot?.hotspots) ? snapshot.hotspots : [];
    const { sentiment, emotions, sentimentFlow, voiceEmotion } = snapshot || {};

    return (
        <div className="mt-4 space-y-4 min-w-0">
            {/* Business-first: summary + hotspots */}
            {hasBusiness && (
                <div className="border rounded-lg overflow-hidden border-primary/20 min-w-0">
                    <div className="bg-primary/5 px-4 py-2 border-b flex items-center gap-2 shrink-0">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <h4 className="text-sm font-medium text-foreground">Summary & highlights</h4>
                    </div>
                    <div className="p-4 space-y-4 min-w-0">
                        {summary && (
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Summary</p>
                                <p className="text-sm leading-relaxed wrap-break-word text-foreground">{summary}</p>
                            </div>
                        )}
                        {hotspots.length > 0 && (
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2 flex items-center gap-1">
                                    <Zap className="h-3 w-3" /> Key points ({hotspots.length})
                                </p>
                                <ul className="space-y-1.5">
                                    {hotspots.slice(0, 10).map((hs: any, i: number) => (
                                        <li key={i} className="text-xs sm:text-sm bg-muted/40 px-2 py-1.5 rounded border wrap-break-word">
                                            {hs?.label ?? hs?.topic ?? hs?.text ?? (typeof hs === "string" ? hs : "Highlight")}
                                        </li>
                                    ))}
                                    {hotspots.length > 10 && (
                                        <li className="text-xs text-muted-foreground">+{hotspots.length - 10} more</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sentiment: compact by default, expandable */}
            {hasSentiment && sentiment && (
                <div className="border rounded-lg overflow-hidden min-w-0">
                    <button
                        type="button"
                        onClick={() => setSentimentExpanded((e) => !e)}
                        className="w-full bg-muted/30 px-4 py-2 border-b flex items-center justify-between shrink-0 text-left hover:bg-muted/40 transition-colors"
                    >
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4 shrink-0" /> Sentiment
                        </h4>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {sentiment.sentiment === "positive" ? (
                                <Smile className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            ) : sentiment.sentiment === "negative" ? (
                                <Frown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            ) : (
                                <Meh className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            )}
                            <span className="capitalize">{sentiment.sentiment}</span>
                            <span>({Math.round(sentiment.score * 100)}%)</span>
                            {sentimentExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </span>
                    </button>
                    {sentimentExpanded && (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t text-muted-foreground">
                            {voiceEmotion && (
                                <div className="space-y-1">
                                    <p className="text-xs">Voice</p>
                                    <div className="flex items-center gap-2">
                                        <Mic2 className="h-3.5 w-3.5" />
                                        <span className="text-sm text-foreground capitalize">{voiceEmotion.primary_emotion}</span>
                                        <Progress value={voiceEmotion.score * 100} className="h-1 w-12" />
                                    </div>
                                </div>
                            )}
                            {(emotions?.length ?? 0) > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs">Emotions</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(emotions ?? []).slice(0, 3).map((e: any, i: number) => (
                                            <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                {e.label} ({(e.score * 100).toFixed(0)}%)
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {(sentimentFlow?.length ?? 0) > 0 && (
                                <div className="space-y-1 col-span-1 md:col-span-2 min-w-0">
                                    <p className="text-xs flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" /> Over time
                                    </p>
                                    <div className="h-8 flex items-end gap-0.5 w-full min-w-0 overflow-hidden">
                                        {(sentimentFlow ?? []).slice(0, 60).map((val: number, i: number) => {
                                            const h = Math.max(8, ((val + 1) / 2) * 100);
                                            const color = val > 0 ? "bg-green-500/50" : val < 0 ? "bg-red-500/50" : "bg-muted";
                                            return (
                                                <div key={i} className={`flex-1 rounded-t-sm ${color} min-w-[2px]`} style={{ height: `${h}%` }} />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
