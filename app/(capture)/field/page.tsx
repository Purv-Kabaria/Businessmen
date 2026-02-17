"use client";

import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Loader2, CheckCircle2, UserRound, Phone, Mail, Mic, MicOff, Square, Play, Trash2, ArrowLeft, Plus } from "lucide-react";

import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { db } from "@/lib/db";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CardScanButton } from "@/modules/capture/card-scan-button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STALL_INTENTS } from "@/modules/capture/constants";
import { addContact, clearDraft, getDeviceId, getDraft, setDraft, type DraftData } from "@/modules/capture/db";
import { hasLocalDuplicate } from "@/modules/capture/local-duplicate";
import { stallLeadSchema, type StallLeadFormValues } from "@/modules/capture/schema";
import type { StallIntent } from "@/modules/capture/constants";

const DRAFT_DEBOUNCE_MS = 500;

function draftToFormValues(d: DraftData): StallLeadFormValues {
  const intent_tags = d.intent_tags ?? [];
  return {
    name: d.name ?? "",
    phone: d.phone ?? "",
    email: d.email ?? "",
    intent_tags,
  };
}

function formIntentTagsToDraft(tags: any[] | undefined): string[] | undefined {
  const list = (tags ?? []).filter((t): t is string => typeof t === "string" && t.trim() !== "");
  return list.length ? list : undefined;
}

export default function FieldPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);
  const [duplicateConfirmPending, setDuplicateConfirmPending] = useState<StallLeadFormValues | null>(null);
  const [capturedCardImage, setCapturedCardImage] = useState<File | null>(null);
  const [interestSearch, setInterestSearch] = useState("");

  const { isRecording, audioBlob, startRecording, stopRecording, clearRecording } = useMediaRecorder();
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const submitLockRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<StallLeadFormValues>({
    resolver: zodResolver(stallLeadSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      intent_tags: [],
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    getDraft("field").then((draft) => {
      if (draft && (draft.name?.trim() || draft.phone?.trim() || draft.email?.trim() || (draft.intent_tags?.length ?? 0) > 0)) {
        setPendingDraft(draft);
        setShowDraftPrompt(true);
      }
    });
  }, []);

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        const name = values.name ?? "";
        const phone = values.phone ?? "";
        const email = values.email ?? "";
        const intent_tags = formIntentTagsToDraft(values.intent_tags);
        if (!name.trim() && !phone.trim() && !email.trim() && !intent_tags?.length) return;
        setDraft({
          mode: "field",
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          intent_tags,
          updated_at: 0,
        }).catch(() => { });
        draftTimerRef.current = null;
      }, DRAFT_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [form.watch]);

  function handleContinueDraft() {
    if (pendingDraft) {
      form.reset(draftToFormValues(pendingDraft));
      clearDraft("field").catch(() => { });
    }
    setPendingDraft(null);
    setShowDraftPrompt(false);
  }

  function handleDiscardDraft() {
    clearDraft("field").catch(() => { });
    setPendingDraft(null);
    setShowDraftPrompt(false);
  }

  async function saveContactToApi(values: StallLeadFormValues) {
    const device_id = getDeviceId();

    let contactRes: Response;
    try {
      contactRes = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: values.name.trim(),
          phone: values.phone,
          email: values.email?.trim() || "",
          intentTags: values.intent_tags,
          sourceMode: "field",
          deviceId: device_id,
        }),
      });
    } catch (err) {
      const isNetworkError = err instanceof TypeError && (err.message === "Failed to fetch" || err.message?.includes("fetch"));
      throw new Error(isNetworkError ? "Cannot reach server. Check your connection and that the app is running." : (err instanceof Error ? err.message : "Request failed."));
    }

    const contactJson = await contactRes.json().catch(() => ({}));
    if (!contactRes.ok) {
      const msg = contactJson?.error?.message ?? contactJson?.message ?? "Failed to save contact";
      if (contactRes.status === 401) throw new Error("Please sign in to save contacts.");
      throw new Error(msg);
    }

    const contact = contactJson?.data;
    if (!contact?.id) throw new Error("Invalid response from server");

    if (audioBlob) {
      const formData = new FormData();
      formData.append("contact_id", contact.id);
      formData.append("audio_file", audioBlob, "recording.webm");
      formData.append("tags", JSON.stringify({ source: "field-capture" }));

      try {
        const interactionRes = await fetch("/api/interactions", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!interactionRes.ok) {
          let msg = "audio upload failed";
          try {
            const interactionJson = await interactionRes.json();
            msg = (interactionJson?.error?.message ?? interactionJson?.message ?? msg) as string;
          } catch {
            msg = interactionRes.status === 503 ? "storage unavailable (check MinIO)" : "audio upload failed";
          }
          console.warn("Audio interaction upload failed:", msg);
          toast.error(`Contact saved, but ${msg.toLowerCase()}.`);
        }
      } catch (err) {
        const isNetworkError = err instanceof TypeError && (err.message === "Failed to fetch" || (err as Error).message?.includes("fetch"));
        toast.error(isNetworkError ? "Contact saved, but could not reach server to upload audio." : "Contact saved, but audio upload failed.");
      }
    }

    clearDraft("field").catch(() => { });
    form.reset({ name: "", phone: "", email: "", intent_tags: [] });
    clearRecording();
    setCapturedCardImage(null);
    setShowSuccess(true);
    toast.success("Saved successfully.");
    setTimeout(() => setShowSuccess(false), 2200);
  }

  async function onSubmit(values: StallLeadFormValues) {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    if (!audioBlob) {
      toast.error("Voice briefing is required!", {
        description: "Please record a short note about this interaction.",
      });
      setIsSubmitting(false);
      submitLockRef.current = false;
      return;
    }

    try {
      const isDuplicate = await hasLocalDuplicate(values.phone, values.email);
      if (isDuplicate) {
        setDuplicateConfirmPending(values);
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }
      await saveContactToApi(values);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not save. Please try again.");
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }

  async function handleDuplicateAddAnyway() {
    if (!duplicateConfirmPending) return;
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await saveContactToApi(duplicateConfirmPending);
      setDuplicateConfirmPending(null);
    } catch (e: any) {
      toast.error(e.message || "Could not save. Please try again.");
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-linear-to-b from-secondary/30 to-background">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-md border-2 border-primary/30 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-primary/10 hover:border-primary/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to home
          </Link>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {showSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex flex-1 flex-col items-center justify-center p-4"
          >
            <div className="rounded-xl border border-primary/20 bg-card p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
              <p className="mt-3 font-semibold">Saved</p>
              <p className="mt-1 text-sm text-muted-foreground">We'll sync when you're back online.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col overflow-auto px-4 py-4"
          >
            <Form {...form}>
              <form id="field-capture-form" onSubmit={form.handleSubmit(onSubmit)} className="mx-auto w-full max-w-xl space-y-4">
                <div className="flex flex-col gap-2">
                  <CardScanButton
                    onCaptured={({ image, data }) => {
                      const file = new File([image], "captured_card.jpg", { type: image.type });
                      setCapturedCardImage(file);

                      if (data.name) form.setValue("name", data.name);
                      if (data.phone) form.setValue("phone", data.phone);
                      if (data.email) form.setValue("email", data.email);

                      toast.success("Card data extracted!");
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  />
                  {capturedCardImage && (
                    <p className="text-xs text-muted-foreground">
                      Card image attached.
                    </p>
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-sm">
                        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                        Name
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" className="h-10 text-base" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        Phone
                      </FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Phone number" className="h-10 text-base" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        Email
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email" className="h-10 text-base" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="intent_tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Interest</FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between h-auto min-h-12 py-2"
                            >
                              {field.value && field.value.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {field.value.map((tag) => (
                                    <Badge variant="secondary" key={tag} className="mr-1">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Select interests...</span>
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command shouldFilter={true}>
                              <CommandInput
                                placeholder="Search or type new..."
                                value={interestSearch}
                                onValueChange={setInterestSearch}
                              />
                              <CommandList className="max-h-[300px]">
                                <CommandEmpty className="p-0">
                                  {interestSearch.trim().length > 0 && (
                                    <div
                                      className="relative flex cursor-default select-none items-center rounded-sm px-2 py-3 text-sm outline-none bg-primary/5 text-primary font-bold hover:bg-primary/10 transition-colors cursor-pointer"
                                      onClick={() => {
                                        const val = interestSearch.trim();
                                        const current = field.value || [];
                                        if (!current.includes(val)) {
                                          field.onChange([...current, val]);
                                        }
                                        setInterestSearch("");
                                      }}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{interestSearch}"
                                    </div>
                                  )}
                                  {!interestSearch.trim() && (
                                    <p className="p-4 text-xs text-center text-muted-foreground">Type to add new interest</p>
                                  )}
                                </CommandEmpty>

                                <CommandGroup heading="Suggestions">
                                  {STALL_INTENTS.map((intent) => (
                                    <CommandItem
                                      value={intent}
                                      key={intent}
                                      onSelect={() => {
                                        const current = field.value || [];
                                        const updated = current.includes(intent)
                                          ? current.filter((v) => v !== intent)
                                          : [...current, intent];
                                        field.onChange(updated);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value?.includes(intent)
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {intent}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>

                                {field.value && field.value.some(tag => !STALL_INTENTS.includes(tag as any)) && (
                                  <CommandGroup heading="Custom Interests">
                                    {field.value
                                      .filter(tag => !STALL_INTENTS.includes(tag as any))
                                      .map((tag) => (
                                        <CommandItem
                                          key={tag}
                                          value={tag}
                                          onSelect={() => {
                                            field.onChange(field.value.filter(t => t !== tag));
                                          }}
                                        >
                                          <Check className="mr-2 h-4 w-4 opacity-100" />
                                          {tag}
                                          <Badge variant="outline" className="ml-auto text-[8px] uppercase py-0 px-1">Added</Badge>
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-4 border-t border-primary/10">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                        <Mic className="h-4 w-4 text-primary" />
                        Interaction Voice Note
                        <span className="text-[9px] bg-primary text-white px-2 py-0.5 rounded-full font-bold">REQUIRED</span>
                      </h4>
                      <p className="text-xs text-muted-foreground">Summarize the conversation briefly.</p>
                    </div>
                    {audioBlob && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive transition-colors"
                        onClick={clearRecording}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Re-record
                      </Button>
                    )}
                  </div>

                  <div className={cn(
                    "relative overflow-hidden rounded-3xl border-2 transition-all duration-500",
                    audioBlob ? "border-primary/30 bg-primary/5 shadow-inner" : "border-dashed border-muted-foreground/20 bg-muted/5",
                    isRecording && "border-primary ring-8 ring-primary/5 shadow-lg"
                  )}>
                    <div className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          {isRecording && (
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1.5, opacity: [0, 0.4, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="absolute inset-0 bg-primary/30 rounded-full"
                            />
                          )}
                          <Button
                            type="button"
                            size="lg"
                            className={cn(
                              "h-16 w-16 rounded-full shadow-2xl transition-all duration-300 z-10 relative",
                              isRecording ? "bg-destructive hover:bg-destructive/90 scale-110" : "bg-primary hover:bg-primary/90"
                            )}
                            onClick={isRecording ? stopRecording : startRecording}
                          >
                            {isRecording ? (
                              <Square className="h-6 w-6 fill-current animate-pulse" />
                            ) : audioBlob ? (
                              <Play className="h-6 w-6 fill-current" />
                            ) : (
                              <Mic className="h-6 w-6" />
                            )}
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-sm font-black tracking-tight">
                            {isRecording ? "Recording Brief..." : audioBlob ? "Briefing Captured" : "Start Briefing"}
                          </p>
                          <div className="flex items-center h-5">
                            {isRecording ? (
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                                <span className="text-sm font-mono font-black text-destructive tabular-nums">
                                  {formatTime(recordingTime)}
                                </span>
                              </div>
                            ) : audioBlob ? (
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/20 p-0.5 rounded-full">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="text-xs font-bold text-primary italic uppercase tracking-wider">Ready for sync</span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground opacity-60">Record at least 3-5 seconds</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isRecording && (
                        <div className="flex gap-1 items-end h-8 pb-1">
                          {[0.1, 0.2, 0.3, 0.4, 0.5, 0.4, 0.3].map((delay, i) => (
                            <motion.div
                              key={i}
                              animate={{ height: [4, 20, 4] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay }}
                              className="w-1 bg-primary rounded-full opacity-60"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </Form>
          </motion.div>
        )}
      </AnimatePresence>

      {!showSuccess && (
        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border/60 bg-background px-4 py-3">
          <div className="mx-auto max-w-xl">
            <Button
              type="submit"
              form="field-capture-form"
              className="h-11 w-full font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </footer>
      )}

      <AlertDialog open={showDraftPrompt} onOpenChange={(open) => !open && handleDiscardDraft()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue previous entry?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved draft. Restore it or start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardDraft}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={handleContinueDraft}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!duplicateConfirmPending} onOpenChange={(open) => !open && setDuplicateConfirmPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already in list</AlertDialogTitle>
            <AlertDialogDescription>
              This phone or email is already captured. Add anyway? (e.g. same office number)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicateConfirmPending(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicateAddAnyway}>Add anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
