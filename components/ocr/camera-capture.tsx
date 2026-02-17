"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
    onCapture: (data: any) => void;
    onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize camera
    useEffect(() => {
        let currentStream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }, // Prefer back camera on mobile
                    audio: false,
                });
                setStream(currentStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = currentStream;
                }
            } catch (err) {
                console.error("Camera access denied:", err);
                setError("Could not access camera. Please allow permissions.");
            }
        };

        startCamera();

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    const handleCapture = useCallback(() => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");

            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert to base64
                const imageData = canvas.toDataURL("image/jpeg", 0.8);
                setCapturedImage(imageData);
            }
        }
    }, []);

    const handleProcessOCR = async () => {
        if (!capturedImage) return;

        setIsProcessing(true);
        try {
            // Create FormData to send image as file (or base64 string)
            // Since our API expects FormData with 'image' file
            const blob = await fetch(capturedImage).then((r) => r.blob());
            const formData = new FormData();
            formData.append("image", blob, "card.jpg");

            const res = await fetch("/api/ocr", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "OCR failed");
            }

            const result = await res.json();

            if (result.success && result.data) {
                toast.success("Card scanned successfully!");
                onCapture(result.data);
            } else {
                throw new Error("Invalid response format");
            }
        } catch (err: any) {
            console.error("OCR Error:", err);
            toast.error(`Scan failed: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setCapturedImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden border shadow-xl relative">
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />

            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                {/* Helper text overlay */}
                {!capturedImage && !error && (
                    <div className="absolute top-4 left-0 right-0 z-10 text-center px-4">
                        <span className="bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                            Center card in frame
                        </span>
                    </div>
                )}

                {/* Video feed */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-300",
                        capturedImage ? "opacity-0 absolute" : "opacity-100"
                    )}
                />

                {/* Captured Image Preview */}
                {capturedImage && (
                    <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full h-full object-contain absolute inset-0 bg-black"
                    />
                )}

                {/* Error State */}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 text-destructive p-4 text-center">
                        {error}
                    </div>
                )}

                {/* Scanning Overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                        <p className="text-sm font-medium animate-pulse">Analyzing with AI...</p>
                    </div>
                )}
            </div>

            {/* Hidden Canvas for capture logic */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Controls */}
            <div className="p-4 bg-card border-t flex items-center justify-between gap-4">
                <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
                    Cancel
                </Button>

                {!capturedImage ? (
                    <div className="flex items-center gap-4">
                        <Button
                            size="lg"
                            className="rounded-full h-12 w-12 p-0 bg-primary hover:bg-primary/90 shadow-lg border-2 border-white ring-2 ring-primary ring-offset-2"
                            onClick={handleCapture}
                            disabled={!!error}
                        >
                            <Camera className="h-6 w-6" />
                        </Button>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full h-10 w-10"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessing}
                            title="Upload Image"
                        >
                            <ImageIcon className="h-5 w-5" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleRetake} disabled={isProcessing}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retake
                        </Button>
                        <Button onClick={handleProcessOCR} disabled={isProcessing}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Use Photo
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Spacer for layout balance */}
                <div className="w-[70px] hidden sm:block"></div>
            </div>
        </div>
    );
}
