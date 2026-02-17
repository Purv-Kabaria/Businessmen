"use client";

import { Sparkles, Check } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ContactUpdateDialogProps {
    isOpen: boolean;
    onClose: (open: boolean) => void;
    suggestedUpdate: {
        name: string | null;
        company: string | null;
        email: string | null;
    } | null;
    setSuggestedUpdate: (update: any) => void;
    onUpdate: () => void;
}

export function ContactUpdateDialog({
    isOpen,
    onClose,
    suggestedUpdate,
    setSuggestedUpdate,
    onUpdate
}: ContactUpdateDialogProps) {
    if (!suggestedUpdate) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md w-[95vw] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 sm:p-8 border-b bg-primary/5">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black italic">Smart Suggestion</DialogTitle>
                            <DialogDescription className="font-bold text-xs opacity-70 underline decoration-primary/30 decoration-2 underline-offset-4">
                                AI detected updated contact info in the transcript
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 sm:p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                            <Input
                                value={suggestedUpdate.name || ""}
                                onChange={(e) => setSuggestedUpdate({ ...suggestedUpdate, name: e.target.value })}
                                className="h-12 rounded-xl bg-muted/30 border-none font-bold focus:ring-2 focus:ring-primary/20"
                                placeholder="Not identified"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Company</label>
                            <Input
                                value={suggestedUpdate.company || ""}
                                onChange={(e) => setSuggestedUpdate({ ...suggestedUpdate, company: e.target.value })}
                                className="h-12 rounded-xl bg-muted/30 border-none font-bold focus:ring-2 focus:ring-primary/20"
                                placeholder="Not identified"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                            <Input
                                value={suggestedUpdate.email || ""}
                                onChange={(e) => setSuggestedUpdate({ ...suggestedUpdate, email: e.target.value })}
                                className="h-12 rounded-xl bg-muted/30 border-none font-bold focus:ring-2 focus:ring-primary/20"
                                placeholder="Not identified"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            onClick={onUpdate}
                            className="w-full h-12 rounded-xl font-black text-sm shadow-lg shadow-primary/20"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Update Contact Profile
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => onClose(false)}
                            className="w-full h-10 rounded-xl font-bold text-xs text-muted-foreground hover:bg-muted/50"
                        >
                            Not now
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
