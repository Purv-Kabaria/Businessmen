import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function OrDivider({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center gap-4 py-4", className)}>
      <Separator className="flex-1" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
        Or
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
