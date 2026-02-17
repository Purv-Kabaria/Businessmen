import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

export interface UseMediaRecorderReturn {
    isRecording: boolean;
    audioBlob: Blob | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    clearRecording: () => void;
    // transcript could be added here if needed later
}

export function useMediaRecorder(): UseMediaRecorderReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast.error("Audio recording is not supported in this browser.");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mimeType = MediaRecorder.isTypeSupported("audio/webm")
                ? "audio/webm"
                : MediaRecorder.isTypeSupported("audio/mp4")
                    ? "audio/mp4"
                    : "";

            const options = mimeType ? { mimeType } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                try {
                    const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
                    setAudioBlob(blob);
                    chunksRef.current = [];
                } catch (e) {
                    console.error("Error creating audio blob", e);
                    toast.error("Failed to process audio recording.");
                }
            };

            // Start recording with 200ms timeslice to ensure data is written periodically
            mediaRecorder.start(200);
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            toast.error("Could not access microphone. Please check permissions.");
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            // Stop all tracks to release mic
            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
            }
        }
    }, []);

    const clearRecording = useCallback(() => {
        setAudioBlob(null);
        setIsRecording(false);
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stop();
            }
            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
            }
        }
        mediaRecorderRef.current = null;
        chunksRef.current = [];
    }, []);

    return {
        isRecording,
        audioBlob,
        startRecording,
        stopRecording,
        clearRecording,
    };
}
