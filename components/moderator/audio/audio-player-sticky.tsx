"use client";

import {
    SkipBack, SkipForward, Play, Pause, VolumeX, Volume2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TrackInfo, AudioInteraction } from "@/types/audio-review";

interface AudioPlayerStickyProps {
    currentTrack: TrackInfo;
    isPlaying: boolean;
    onTogglePlay: () => void;
    progress: number;
    duration: number | null;
    onSeek: (value: number) => void;
    volume: number;
    onVolumeChange: (value: number) => void;
    isMuted: boolean;
    onToggleMute: () => void;
    onClose: () => void;
    formatTime: (seconds: number | null) => string;
    interactions: AudioInteraction[];
}

export function AudioPlayerSticky({
    currentTrack,
    isPlaying,
    onTogglePlay,
    progress,
    duration,
    onSeek,
    volume,
    onVolumeChange,
    isMuted,
    onToggleMute,
    onClose,
    formatTime,
    interactions
}: AudioPlayerStickyProps) {
    const activeInteraction = interactions.find(i => i.id === currentTrack.id);

    return (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-3 sm:px-4 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-background/95 dark:bg-background/95 backdrop-blur-xl border border-border shadow-lg rounded-2xl p-3 sm:p-4 flex items-center gap-4 sm:gap-8">
                {/* Track Info */}
                <div className="min-w-0 max-w-[120px] sm:max-w-[200px] hidden xs:block">
                    <h4 className="font-semibold text-xs sm:text-sm truncate text-foreground">{currentTrack.title}</h4>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{currentTrack.subtitle}</p>
                </div>

                {/* Controls & Progress */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors duration-200 ease-out hover:scale-105 active:scale-95"
                            onClick={() => onSeek(progress - 10)}
                        >
                            <SkipBack className="h-5 w-5" />
                        </Button>

                        <Button
                            className="h-12 w-12 rounded-full shadow-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 ease-out hover:scale-105 active:scale-95"
                            onClick={onTogglePlay}
                        >
                            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current pl-1" />}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors duration-200 ease-out hover:scale-105 active:scale-95"
                            onClick={() => onSeek(progress + 10)}
                        >
                            <SkipForward className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="w-full flex items-center gap-3 text-[10px] sm:text-xs tabular-nums text-muted-foreground font-medium">
                        <span className="w-8 shrink-0">{formatTime(progress)}</span>
                        <div className="relative flex-1 h-6 flex items-center">
                            {/* Hotspot Markers Overlay - visible in light and dark */}
                            {duration && activeInteraction?.structuredSnapshot?.hotspots?.map((hs: any, idx: number) => {
                                const left = (hs.start / duration) * 100;
                                const width = ((hs.end - hs.start) / duration) * 100;
                                return (
                                    <div
                                        key={idx}
                                        className="absolute h-3 bg-amber-500/70 dark:bg-amber-400/60 rounded-full z-0 ring-1 ring-amber-600/20 dark:ring-amber-400/30"
                                        style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%` }}
                                    />
                                );
                            })}

                            <Slider
                                value={[progress]}
                                max={duration || 100}
                                step={0.1}
                                onValueChange={(vals) => onSeek(vals[0])}
                                className="relative z-10 flex-1"
                            />
                        </div>
                        <span className="w-8 text-right shrink-0">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Volume & Close */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="hidden lg:flex items-center gap-2.5 min-w-0">
                        <button
                            type="button"
                            onClick={onToggleMute}
                            className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 ease-out hover:scale-105 active:scale-95"
                        >
                            {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </button>
                        <Slider
                            value={[isMuted ? 0 : volume]}
                            max={1}
                            step={0.01}
                            onValueChange={(vals) => onVolumeChange(vals[0])}
                            className="w-20 shrink-0"
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors duration-200 ease-out hover:scale-105 active:scale-95"
                        onClick={onClose}
                    >
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
