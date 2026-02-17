import { CaptureSyncButtons } from "@/components/offline/capture-sync-buttons";

export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-background overflow-auto">
      <header className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-border bg-background px-4 py-2">
        <CaptureSyncButtons />
      </header>
      {children}
    </div>
  );
}
