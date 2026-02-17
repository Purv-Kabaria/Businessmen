"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Save, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
    appendContactInteraction,
    getAllContacts,
    enqueueAudioTranscriptItem,
    type ContactRecord,
} from "@/modules/capture/db";

export function InteractionCapture() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
    const [contacts, setContacts] = useState<ContactRecord[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [transcript, setTranscript] = useState(""); // Manual note for now
    const [isSaving, setIsSaving] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const selectedContactRef = useRef<ContactRecord | null>(null);
    const recordingEnqueuedRef = useRef(false);

    useEffect(() => {
        selectedContactRef.current = selectedContact;
    }, [selectedContact]);

    useEffect(() => {
        getAllContacts().then(setContacts);
    }, []);

    const searchResults = searchQuery.length >= 2
        ? contacts.filter(
            (c) =>
                c.name.toLowerCase().startsWith(searchQuery.toLowerCase()) ||
                c.phone.startsWith(searchQuery)
        ).slice(0, 5)
        : [];

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                setAudioBlob(blob);
                chunksRef.current = [];
                const contact = selectedContactRef.current;
                if (contact) {
                    const now = Date.now();
                    enqueueAudioTranscriptItem({
                        audio_blob: blob,
                        contact_local_id: contact.local_id,
                        source_mode: "field",
                    }).then((id) => {
                        recordingEnqueuedRef.current = true;
                        appendContactInteraction(contact.local_id, { id, created_at: now }).catch(() => {});
                    });
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast.error("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Stop all tracks to release mic
            mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
    };

    const handleSave = async () => {
        if (!selectedContact) {
            toast.error("Please select a contact first.");
            return;
        }
        if (!audioBlob) {
            toast.info("Record audio to save to the queue.");
            return;
        }

        setIsSaving(true);
        try {
            if (recordingEnqueuedRef.current) {
                recordingEnqueuedRef.current = false;
                toast.success("Audio saved offline. Use Sync audio when online.");
            } else {
                const now = Date.now();
                const id = await enqueueAudioTranscriptItem({
                    audio_blob: audioBlob,
                    contact_local_id: selectedContact.local_id,
                    source_mode: "field",
                });
                await appendContactInteraction(selectedContact.local_id, { id, created_at: now });
                toast.success("Audio saved offline. Use Sync audio when online.");
            }
            setSelectedContact(null);
            setSearchQuery("");
            setAudioBlob(null);
            setTranscript("");
        } catch (error) {
            console.error("Failed to save:", error);
            toast.error("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-md p-6 bg-card rounded-lg border shadow-sm space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Log Interaction</h2>
            </div>

            {/* 1. Select Contact */}
            <div className="space-y-4">
                <Label>Select Contact</Label>
                {!selectedContact ? (
                    <div className="relative">
                        <Input
                            placeholder="Search by name or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchResults && searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg">
                                {searchResults.map((contact) => (
                                    <div
                                        key={contact.local_id}
                                        className="p-2 hover:bg-muted cursor-pointer text-sm"
                                        onClick={() => {
                                            setSelectedContact(contact);
                                            setSearchQuery("");
                                        }}
                                    >
                                        <div className="font-medium">{contact.name}</div>
                                        <div className="text-xs text-muted-foreground">{contact.phone}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                        <div>
                            <div className="font-medium">{selectedContact.name}</div>
                            <div className="text-xs text-muted-foreground">{selectedContact.phone}</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedContact(null)}>
                            Change
                        </Button>
                    </div>
                )}
            </div>

            {/* 2. Record Audio */}
            <div className="space-y-2">
                <Label>Audio Note</Label>
                <div className="flex items-center gap-4">
                    {!isRecording ? (
                        <Button
                            variant={audioBlob ? "outline" : "default"}
                            onClick={startRecording}
                            className="w-full"
                        >
                            <Mic className="mr-2 h-4 w-4" />
                            {audioBlob ? "Re-record" : "Start Recording"}
                        </Button>
                    ) : (
                        <Button variant="destructive" onClick={stopRecording} className="w-full animate-pulse">
                            <Square className="mr-2 h-4 w-4" />
                            Stop Recording
                        </Button>
                    )}
                </div>
                {audioBlob && !isRecording && (
                    <div className="text-xs text-green-600 flex items-center mt-2">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Audio recorded ready to save.
                    </div>
                )}
            </div>

            {/* 3. Manual Note / Transcript */}
            <div className="space-y-2">
                <Label>Quick Note / Transcript</Label>
                <Textarea
                    placeholder="Enter manual notes here..."
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={3}
                />
            </div>

            {/* 4. Save Button */}
            <Button onClick={handleSave} className="w-full" disabled={isSaving || !selectedContact || !audioBlob}>
                {isSaving ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" /> Save Interaction
                    </>
                )}
            </Button>
        </div>
    );
}
