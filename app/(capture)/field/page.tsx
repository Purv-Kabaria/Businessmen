"use client";

import { motion } from "framer-motion";

export default function FieldPage() {
  return (
    <main className="flex min-h-screen flex-col bg-linear-to-b from-secondary/30 to-background">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <motion.h1
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-lg font-semibold tracking-tight"
        >
          Field capture
        </motion.h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quick capture — form will go here (A6).
        </p>
      </header>
      <div className="flex flex-1 flex-col overflow-auto px-4 py-4">
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            One-handed optimized layout. Primary action will sit at the bottom for thumb reach.
          </p>
        </div>
      </div>
      <footer className="shrink-0 border-t border-border/60 bg-background px-4 py-3">
        <div className="mx-auto max-w-md" />
      </footer>
    </main>
  );
}
