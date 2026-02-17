"use client";

import { Search, X, FileAudio, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AudioHeaderProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    totalRecordings: number;
    isExporting: boolean;
    onExportCSV: () => void;
}

export function AudioHeader({
    searchQuery,
    onSearchChange,
    totalRecordings,
    isExporting,
    onExportCSV
}: AudioHeaderProps) {
    return (
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Audio review</h1>
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-sm">
                        <FileAudio className="h-4 w-4" />
                        {totalRecordings} recording{totalRecordings !== 1 ? "s" : ""}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onExportCSV}
                        disabled={isExporting}
                        className="h-8 text-xs"
                    >
                        {isExporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="relative w-full sm:w-72 lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search contacts, companies..."
                    className="pl-9 h-9 text-sm"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchChange("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
