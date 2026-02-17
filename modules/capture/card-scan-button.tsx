"use client";

import { useState } from "react";
import { Scan, TextSelect } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CameraCapture } from "@/components/ocr/camera-capture";

export type OCRData = {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
};

export type OCRResult = {
  image: Blob;
  data: OCRData;
};

export type CardScanButtonProps = {
  onCaptured: (result: OCRResult) => void;
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
  const [open, setOpen] = useState(false);

  const handleCapture = (result: any) => {
    // result comes from CameraCapture as { image: Blob, data: any }
    // Transform to our type if needed, or pass through
    onCaptured(result);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children ?? (
          <>
            <Scan className="mr-2 h-4 w-4" />
            Scan / Upload Card
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-lg">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <TextSelect className="h-5 w-5" />
              Scan Business Card
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 relative bg-black">
            <CameraCapture onCapture={handleCapture} onClose={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
