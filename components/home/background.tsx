"use client";

export function Background() {
  return (
    <div className="absolute inset-0 z-0 opacity-60">
      <div className="absolute -left-[5%] -top-[10%] w-64 h-64 bg-primary rounded-full mix-blend-multiply filter blur-2xl animate-[blob_18s_ease-in-out_infinite]" />
      <div className="absolute -right-[5%] top-[20%] w-72 h-72 bg-chart-2 rounded-full mix-blend-multiply filter blur-2xl animate-[blob_22s_ease-in-out_infinite] [animation-delay:2s]" />
      <div className="absolute -left-[10%] bottom-[15%] w-80 h-80 bg-accent rounded-full mix-blend-multiply filter blur-2xl animate-[blob_26s_ease-in-out_infinite] [animation-delay:4s]" />
      <div className="absolute right-[10%] bottom-[5%] w-60 h-60 bg-secondary rounded-full mix-blend-multiply filter blur-2xl animate-[blob_20s_ease-in-out_infinite] [animation-delay:6s]" />
      <div className="absolute left-[20%] top-[10%] w-52 h-52 bg-chart-3 rounded-full mix-blend-multiply filter blur-2xl animate-[blob_24s_ease-in-out_infinite] [animation-delay:8s]" />
      <div className="absolute right-[15%] top-[50%] w-56 h-56 bg-primary/70 rounded-full mix-blend-multiply filter blur-2xl animate-[blob_28s_ease-in-out_infinite] [animation-delay:10s]" />
      <div className="absolute left-[5%] top-[55%] w-44 h-44 bg-accent/70 rounded-full mix-blend-multiply filter blur-2xl animate-[blob_30s_ease-in-out_infinite] [animation-delay:12s]" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[8%] w-72 h-72 bg-chart-4 rounded-full mix-blend-multiply filter blur-2xl animate-[blob_26s_ease-in-out_infinite] [animation-delay:14s]" />
    </div>
  );
}