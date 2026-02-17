"use client";

import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, CheckCircle2, UserRound, Phone, Mail, Mic, MicOff } from "lucide-react";

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
import { STALL_INTENTS } from "@/modules/capture/constants";
import { addContact, clearDraft, getDeviceId, getDraft, setDraft, type DraftData } from "@/modules/capture/db";
import { hasLocalDuplicate } from "@/modules/capture/local-duplicate";
import { stallLeadSchema, type StallLeadFormValues } from "@/modules/capture/schema";
import type { StallIntent } from "@/modules/capture/constants";

const DRAFT_DEBOUNCE_MS = 500;

function draftToFormValues(d: DraftData): StallLeadFormValues {
  const rawTags = d.intent_tags ?? [];
  const intent_tags = rawTags.filter((t) => STALL_INTENTS.includes(t as StallIntent)) as StallLeadFormValues["intent_tags"];
  return {
    name: d.name ?? "",
    phone: d.phone ?? "",
    email: d.email ?? "",
    intent_tags,
  };
}

function formIntentTagsToDraft(tags: (StallIntent | undefined)[] | undefined): string[] | undefined {
  const list = (tags ?? []).filter((t): t is StallIntent => t != null);
  return list.length ? list : undefined;
}

export default function FieldPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);
  const [duplicateConfirmPending, setDuplicateConfirmPending] = useState<StallLeadFormValues | null>(null);
  const [audioLocalId, setAudioLocalId] = useState<string | null>(null);
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
        }).catch(() => {});
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
      clearDraft("field").catch(() => {});
    }
    setPendingDraft(null);
    setShowDraftPrompt(false);
  }

  function handleDiscardDraft() {
    clearDraft("field").catch(() => {});
    setPendingDraft(null);
    setShowDraftPrompt(false);
  }

  async function saveContactToIndexedDB(values: StallLeadFormValues) {
    const local_id = crypto.randomUUID();
    const device_id = getDeviceId();
    const now = Date.now();
    await addContact({
      local_id,
      server_id: null,
      name: values.name.trim(),
      phone: values.phone,
      email: values.email?.trim() || null,
      company: null,
      intent_tags: values.intent_tags,
      source_mode: "field",
      version: 1,
      pending_sync: true,
      device_id,
      updated_at: now,
      event_id: null,
      audio_local_id: audioLocalId ?? null,
    });
    clearDraft("field").catch(() => {});
    form.reset({ name: "", phone: "", email: "", intent_tags: [] });
    setAudioLocalId(null);
    setShowSuccess(true);
    toast.success("Saved. We'll sync when you're back online.");
    setTimeout(() => setShowSuccess(false), 2200);
  }

  async function onSubmit(values: StallLeadFormValues) {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const isDuplicate = await hasLocalDuplicate(values.phone, values.email);
      if (isDuplicate) {
        setDuplicateConfirmPending(values);
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }
      await saveContactToIndexedDB(values);
    } catch (e) {
      toast.error("Could not save. Please try again.");
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
      await saveContactToIndexedDB(duplicateConfirmPending);
      setDuplicateConfirmPending(null);
    } catch (e) {
      toast.error("Could not save. Please try again.");
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }

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
          Quick capture. Save when ready.
        </p>
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
                        <ToggleGroup
                          type="multiple"
                          value={field.value}
                          onValueChange={field.onChange}
                          variant="outline"
                          size="default"
                          className="grid w-full grid-cols-2 gap-2"
                        >
                          {STALL_INTENTS.map((intent) => (
                            <ToggleGroupItem
                              key={intent}
                              value={intent}
                              className="min-h-10 rounded-lg text-left text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                            >
                              {intent}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-2">
                  <FormLabel className="text-sm">Voice note (optional)</FormLabel>
                  <div className="mt-1.5 flex items-center gap-2">
                    {audioLocalId ? (
                      <>
                        <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
                          <Mic className="h-3.5 w-3.5" />
                          Voice note added
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground"
                          onClick={() => setAudioLocalId(null)}
                        >
                          <MicOff className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5"
                        onClick={() => setAudioLocalId(crypto.randomUUID())}
                      >
                        <Mic className="h-3.5 w-3.5" />
                        Add voice note ref
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Links this contact for a voice note (Member 2).
                  </p>
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
