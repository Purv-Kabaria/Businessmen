'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, RefreshCw, ChevronLeft, Target, AlertCircle, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface SimulationMeta {
    model?: string;
    retrieval?: string;
    latency_ms?: number;
}

interface SimulationData {
    likely_objections: string[];
    repetition_risks: string[];
    strategic_sequence: string[];
    tone_recommendation: string;
    alignment_warning: string;
    commitment_gaps: string[];
    confidence_score: number;
    meta?: SimulationMeta;
}

export default function SimulationPage() {
    const params = useParams();
    const router = useRouter();
    const contactId = params.contactId as string;

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SimulationData | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function fetchSimulation() {
        setLoading(true);
        setError(null);
        setData(null); // Don't show previous latency/data until this request is fully done
        try {
            const res = await fetch('/api/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId })
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Simulation failed');
            }

            setData(result.data);
            toast.success("Strategy generated");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to generate simulation");
            toast.error("Simulation failed");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (contactId) {
            fetchSimulation();
        }
    }, [contactId]);

    if (loading && !data) {
        return (
            <div className="flex min-h-screen items-center justify-center flex-col gap-4 px-4 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <AlertCircle className="h-10 w-10 text-destructive shrink-0" />
                <h2 className="text-lg font-semibold text-center">Simulation failed</h2>
                <p className="text-muted-foreground max-w-md text-center text-sm">{error}</p>
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                    <Button variant="outline" onClick={() => router.back()}>Back</Button>
                    <Button onClick={fetchSimulation}>Retry</Button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1 min-w-0">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4 mr-1 shrink-0" /> Back to contact
                    </Button>
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex flex-wrap items-center gap-2">
                        <ListOrdered className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground shrink-0" />
                        <span className="wrap-break-word">Call strategy</span>
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Suggested approach for the next interaction.
                    </p>
                </div>
                <div className="flex flex-row flex-wrap items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Confidence</span>
                        <Progress value={data.confidence_score} className="w-20 h-2 min-w-0" />
                        <span className="text-sm text-muted-foreground">{data.confidence_score}%</span>
                    </div>
                    <Button onClick={fetchSimulation} disabled={loading} variant="outline" size="sm">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                        Refresh
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Warnings Section - only show when there is real content */}
            {(data.alignment_warning?.trim() || data.commitment_gaps.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {data.alignment_warning?.trim() && (
                        <Card className="border-destructive/30 min-w-0 overflow-hidden">
                            <CardHeader className="pb-2 px-4 sm:px-6">
                                <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0" /> Alignment warning
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6">
                                <p className="text-sm leading-relaxed wrap-break-word">{data.alignment_warning}</p>
                            </CardContent>
                        </Card>
                    )}

                    {data.commitment_gaps.length > 0 && (
                        <Card className="border-amber-500/30 min-w-0 overflow-hidden">
                            <CardHeader className="pb-2 px-4 sm:px-6">
                                <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <Target className="h-4 w-4 shrink-0" /> Commitment gaps
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6">
                                <ul className="space-y-2">
                                    {data.commitment_gaps.map((gap, i) => (
                                        <li key={i} className="text-xs sm:text-sm font-medium flex items-start gap-2 wrap-break-word">
                                            <span className="text-yellow-500 mt-1 shrink-0">•</span> <span>{gap}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Business-first: Recommended sequence + objections + repetition (main content) */}
            <div className="space-y-6 sm:space-y-8">
                <Card className="min-w-0 overflow-hidden border-primary/20">
                    <CardHeader className="px-4 sm:px-6 pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <ListOrdered className="h-4 w-4 shrink-0 text-primary" /> Recommended sequence
                        </CardTitle>
                        <CardDescription className="text-sm">Suggested conversation steps based on history.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-6">
                        <ol className="space-y-3 relative pl-4 border-l border-border ml-1 py-1">
                            {(data.strategic_sequence.filter((step, i, arr) => arr.findIndex((s) => s.trim() === step.trim()) === i)).map((step, i) => (
                                <li key={i} className="relative min-w-0">
                                    <span className="absolute -left-4 top-0 text-xs text-muted-foreground font-medium">{i + 1}.</span>
                                    <p className="text-sm leading-relaxed wrap-break-word pl-0">{step}</p>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader className="pb-2 px-4 sm:px-6">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Target className="h-4 w-4 shrink-0 text-muted-foreground" /> Predicted objections
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <ul className="space-y-2">
                                {data.likely_objections.map((obj, i) => (
                                    <li key={i} className="text-xs sm:text-sm bg-muted/40 p-2 rounded-md border text-foreground/90 wrap-break-word">
                                        {obj}
                                    </li>
                                ))}
                                {data.likely_objections.length === 0 && <p className="text-xs sm:text-sm text-muted-foreground italic">None detected.</p>}
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader className="pb-2 px-4 sm:px-6">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                Repetition risks
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            <ul className="space-y-2">
                                {data.repetition_risks.map((risk, i) => (
                                    <li key={i} className="text-xs sm:text-sm bg-muted/40 p-2 rounded-md border text-foreground/90 wrap-break-word">
                                        {risk}
                                    </li>
                                ))}
                                {data.repetition_risks.length === 0 && <p className="text-xs sm:text-sm text-muted-foreground italic">None detected.</p>}
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                {/* Tone: compact */}
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="text-muted-foreground font-medium">Tone:</span>
                    <span className="text-foreground">{data.tone_recommendation}</span>
                </div>

                {/* Metadata: minimal one-line technical details */}
                <div className="text-xs text-muted-foreground font-mono flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>{data.meta?.model ?? "Gemma 3 (4B)"}</span>
                    <span>·</span>
                    <span>{data.meta?.retrieval ?? "RAG (FAISS)"}</span>
                    {data.meta?.latency_ms != null && !loading && (
                        <>
                            <span>·</span>
                            <span>{(data.meta.latency_ms / 1000).toFixed(2)}s</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
