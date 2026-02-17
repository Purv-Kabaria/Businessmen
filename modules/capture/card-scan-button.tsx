"use client";

import { useRef, useState, useCallback } from "react";
import { Scan, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CardScanButtonProps = {
  onCaptured: (file: File) => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  className?: string;
  children?: React.ReactNode;
};

export function CardScanButton({
  onCaptured,
  variant = "outline",
  size = "default",
  className,
  children,
}: CardScanButtonProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const openChoiceDialog = useCallback(() => {
    setChoiceDialogOpen(true);
  }, []);

  const triggerUpload = useCallback(() => {
    setChoiceDialogOpen(false);
    setTimeout(() => uploadInputRef.current?.click(), 100);
  }, []);

  const triggerScan = useCallback(() => {
    setChoiceDialogOpen(false);
    setTimeout(() => scanInputRef.current?.click(), 100);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setPreviewFile(file);
      setPreviewDialogOpen(true);
    },
    [previewUrl]
  );

  const handleRetake = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewFile(null);
    setPreviewDialogOpen(false);
    setTimeout(() => setChoiceDialogOpen(true), 100);
  }, [previewUrl]);

  const handleUsePhoto = useCallback(() => {
    if (previewFile) {
      onCaptured(previewFile);
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setPreviewDialogOpen(false);
  }, [previewFile, previewUrl, onCaptured]);

  const handleChoiceDialogOpenChange = useCallback((open: boolean) => {
    setChoiceDialogOpen(open);
  }, []);

  const handlePreviewDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewFile(null);
      setPreviewDialogOpen(open);
    },
    [previewUrl]
  );

  return (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={handleFileChange}
      />
      <input
        ref={scanInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={openChoiceDialog}
      >
        {children ?? (
          <>
            <Scan className="h-4 w-4" />
            Scan card
          </>
        )}
      </Button>
      <Dialog open={choiceDialogOpen} onOpenChange={handleChoiceDialogOpenChange}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Add card</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex h-auto flex-col gap-2 py-6"
              onClick={triggerUpload}
            >
              <Upload className="h-8 w-8" />
              Upload image
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex h-auto flex-col gap-2 py-6"
              onClick={triggerScan}
            >
              <Scan className="h-8 w-8" />
              Scan card
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={previewDialogOpen} onOpenChange={handlePreviewDialogOpenChange}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="relative aspect-3/2 w-full overflow-hidden rounded-lg border bg-muted">
              <img
                src={previewUrl}
                alt="Captured card"
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleRetake}>
              Retake
            </Button>
            <Button type="button" onClick={handleUsePhoto}>
              Use photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
