"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaginationInfo } from "@/types/audio-review";

interface AudioPaginationProps {
    pagination: PaginationInfo | null;
    currentPage: number;
    onPageChange: (page: number) => void;
    loading: boolean;
}

export function AudioPagination({
    pagination,
    currentPage,
    onPageChange,
    loading
}: AudioPaginationProps) {
    if (!pagination || pagination.totalPages <= 1) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1 || loading}
                    onClick={() => onPageChange(currentPage - 1)}
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
                                    onClick={() => onPageChange(p)}
                                    disabled={loading}
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
                    disabled={currentPage === pagination.totalPages || loading}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="rounded-xl px-4 h-10 font-bold text-xs"
                >
                    Next <ChevronRight className="h-4 w-4 ml-1.5" />
                </Button>
            </div>
        </div>
    );
}
