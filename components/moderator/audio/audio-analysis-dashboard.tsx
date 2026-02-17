"use client";

import { Activity, Smile, Frown, Meh, Mic2, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AudioInteraction } from "@/types/audio-review";

interface AudioAnalysisDashboardProps {
    interaction: AudioInteraction;
}

export function AudioAnalysisDashboard({ interaction }: AudioAnalysisDashboardProps) {
    if (!interaction.structuredSnapshot?.sentiment) return null;

    const { sentiment, emotions, sentimentFlow, voiceEmotion } = interaction.structuredSnapshot;

    return (
        <div className="mt-4 border rounded-lg overflow-hidden max-h-[320px] flex flex-col min-w-0">
            <div className="bg-muted/30 px-4 py-2 border-b flex items-center justify-between shrink-0">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 shrink-0" /> Sentiment analysis
                </h4>
                <span className="text-xs text-muted-foreground">RoBERTa + Wav2Vec2</span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto min-h-0">
                {/* 1. Sentiment */}
                <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Overall tone</p>
                    <div className="flex items-center gap-2">
                        {sentiment.sentiment === 'positive' ? (
                            <Smile className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                        ) : sentiment.sentiment === 'negative' ? (
                            <Frown className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                        ) : (
                            <Meh className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                        <div>
                            <span className="text-sm font-medium capitalize">{sentiment.sentiment}</span>
                            <span className="text-xs text-muted-foreground ml-1">({Math.round(sentiment.score * 100)}%)</span>
                        </div>
                    </div>
                </div>

                {/* 2. Voice */}
                <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Voice emotion</p>
                    {voiceEmotion ? (
                        <div className="flex items-center gap-2">
                            <Mic2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                                <span className="text-sm font-medium capitalize">{voiceEmotion.primary_emotion}</span>
                                <Progress value={voiceEmotion.score * 100} className="h-1 w-16 mt-0.5" />
                            </div>
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                    )}
                </div>

                {/* 3. Emotions */}
                <div className="space-y-1.5 col-span-1 md:col-span-2 lg:col-span-1">
                    <p className="text-xs text-muted-foreground">Top emotions</p>
                    <div className="flex flex-wrap gap-1.5">
                        {emotions?.slice(0, 3).map((e: any, i: number) => (
                            <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
                                {e.label} ({(e.score * 100).toFixed(0)}%)
                            </span>
                        ))}
                    </div>
                </div>

                {/* 4. Sentiment flow */}
                <div className="space-y-1.5 col-span-1 md:col-span-2 lg:col-span-1 min-w-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 shrink-0" /> Sentiment over time
                    </p>
                    <div className="h-10 flex items-end gap-0.5 w-full min-w-0 overflow-hidden">
                        {(sentimentFlow?.length ? sentimentFlow.slice(0, 80) : []).map((val: number, i: number) => {
                            const h = Math.max(10, ((val + 1) / 2) * 100);
                            const color = val > 0 ? "bg-green-500/50" : val < 0 ? "bg-red-500/50" : "bg-muted";
                            return (
                                <div key={i} className={`flex-1 rounded-t-sm ${color} min-w-[2px]`} style={{ height: `${h}%` }} title={`Segment ${i}: ${val.toFixed(2)}`} />
                            );
                        })}
                        {(!sentimentFlow || sentimentFlow.length === 0) && (
                            <div className="text-xs text-muted-foreground italic h-full flex items-center">Not enough data</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
