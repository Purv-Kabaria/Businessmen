"use client";

import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CardScanButton, type OCRResult } from "@/modules/capture/card-scan-button";
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
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, UserRound, Phone, Mail, Check, ChevronsUpDown, X, ArrowLeft } from "lucide-react";
import { STALL_INTENTS } from "@/modules/capture/constants";
import { addContact, clearDraft, getDeviceId, getDraft, setDraft, type DraftData } from "@/modules/capture/db";
import { hasLocalDuplicate } from "@/modules/capture/local-duplicate";
import { stallLeadSchema, type StallLeadFormValues } from "@/modules/capture/schema";
import type { StallIntent } from "@/modules/capture/constants";

const DRAFT_DEBOUNCE_MS = 500;

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

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

export default function StallPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);
  const [duplicateConfirmPending, setDuplicateConfirmPending] = useState<StallLeadFormValues | null>(null);
  const [capturedCardImage, setCapturedCardImage] = useState<File | null>(null);
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
    getDraft("stall").then((draft) => {
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
          mode: "stall",
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
      clearDraft("stall").catch(() => { });
    }
    setPendingDraft(null);
    setShowDraftPrompt(false);
  }

  function handleDiscardDraft() {
    clearDraft("stall").catch(() => { });
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
      source_mode: "stall",
      version: 1,
      pending_sync: true,
      device_id,
      updated_at: now,
      event_id: null,
    });
    clearDraft("stall").catch(() => { });
    form.reset({ name: "", phone: "", email: "", intent_tags: [] });
    setCapturedCardImage(null);
    setShowSuccess(true);
    toast.success("Saved. We'll sync when you're back online.");
    setTimeout(() => setShowSuccess(false), 2200);
  }

  async function onSubmit(values: StallLeadFormValues) {
    setIsSubmitting(true);
    try {
      const isDuplicate = await hasLocalDuplicate(values.phone, values.email);
      if (isDuplicate) {
        setDuplicateConfirmPending(values);
        setIsSubmitting(false);
        return;
      }
      await saveContactToIndexedDB(values);
    } catch (e) {
      toast.error("Could not save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDuplicateAddAnyway() {
    if (!duplicateConfirmPending) return;
    setIsSubmitting(true);
    try {
      await saveContactToIndexedDB(duplicateConfirmPending);
      setDuplicateConfirmPending(null);
    } catch (e) {
      toast.error("Could not save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-linear-to-b from-secondary/40 to-background">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-4 py-3">
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-2 rounded-md border-2 border-primary/30 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-primary/10 hover:border-primary/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Go to home
        </Link>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-4">
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
      <AnimatePresence mode="wait">
        {showSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="w-full max-w-xl"
          >
            <Card className="overflow-hidden border-primary/20 shadow-lg shadow-primary/5">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                >
                  <CheckCircle2 className="h-16 w-16 text-primary" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-4 text-xl font-semibold"
                >
                  Thank you!
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  We&apos;ll be in touch soon.
                </motion.p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-xl"
          >
            <Card className="overflow-hidden border-border/80 shadow-xl">
              <CardHeader className="space-y-1.5 pb-4 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <CardTitle className="text-2xl tracking-tight">
                    Lead capture
                  </CardTitle>
                </motion.div>
                <CardDescription className="text-base">
                  Share your details to get in touch.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
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
                        size="lg"
                        className="w-full"
                      />
                      {capturedCardImage && (
                        <p className="text-xs text-muted-foreground">
                          Card image attached.
                        </p>
                      )}
                    </div>
                    <motion.div
                      variants={container}
                      initial="hidden"
                      animate="visible"
                      className="space-y-5"
                    >
                      <motion.div variants={item}>
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 text-sm font-medium">
                                <UserRound className="h-4 w-4 text-muted-foreground" />
                                Name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Full name"
                                  autoFocus
                                  className="h-11 text-base"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                      <motion.div variants={item}>
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 text-sm font-medium">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                Phone
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="tel"
                                  placeholder="Phone number"
                                  className="h-11 text-base"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                      <motion.div variants={item}>
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 text-sm font-medium">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                Email
                                <span className="text-muted-foreground font-normal">
                                  (optional)
                                </span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="Email"
                                  className="h-11 text-base"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                      <motion.div variants={item}>
                        <FormField
                          control={form.control}
                          name="intent_tags"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                I am interested in
                              </FormLabel>
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
                                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search intent..." />
                                      <CommandList>
                                        <CommandEmpty>No intent found.</CommandEmpty>
                                        <CommandGroup>
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
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Button
                        type="submit"
                        className="h-12 w-full text-base font-medium"
                        size="lg"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          "Submit"
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </main>
  );
}
