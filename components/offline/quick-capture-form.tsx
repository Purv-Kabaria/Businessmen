"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, WifiOff } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    email: z.string().email().optional().or(z.literal("")),
    company: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface QuickCaptureFormProps {
    initialData?: Partial<FormValues> | null;
}

export function QuickCaptureForm({ initialData }: QuickCaptureFormProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            phone: "",
            email: "",
            company: "",
        },
    });

    // Populate form when initialData changes (e.g. from OCR)
    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name || "",
                phone: initialData.phone || "",
                email: initialData.email || "",
                company: initialData.company || "",
            });
            toast.info("Form pre-filled from scan!");
        }
    }, [initialData, form]);

    async function onSubmit(data: FormValues) {
        setIsSaving(true);
        try {
            // Offline-First Logic: Save directly to local DB
            await db.contacts.add({
                id: crypto.randomUUID(),
                name: data.name,
                phone: data.phone,
                email: data.email || undefined,
                company: data.company || undefined,
                currentStage: "Met",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                syncStatus: "pending",
            });

            setSuccess(true);
            toast.success("Contact saved locally!");
            form.reset();

            // Clear success message after 2 seconds
            setTimeout(() => setSuccess(false), 2000);
        } catch (error) {
            console.error("Failed to save contact:", error);
            toast.error("Failed to save contact. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="w-full max-w-md p-6 bg-card rounded-lg border shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Quick Capture</h2>
                <div className="flex items-center text-xs text-muted-foreground gap-1">
                    <WifiOff className="h-3 w-3" />
                    <span>Offline Ready</span>
                </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" placeholder="John Doe" {...form.register("name")} />
                    {form.formState.errors.name && (
                        <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="company">Company (Optional)</Label>
                    <Input id="company" placeholder="Acme Corp" {...form.register("company")} />
                    {form.formState.errors.company && (
                        <p className="text-destructive text-sm">{form.formState.errors.company.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="+1234567890" {...form.register("phone")} />
                    {form.formState.errors.phone && (
                        <p className="text-destructive text-sm">{form.formState.errors.phone.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input id="email" placeholder="john@example.com" {...form.register("email")} />
                    {form.formState.errors.email && (
                        <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={isSaving || success}>
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                        </>
                    ) : success ? (
                        <>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Saved!
                        </>
                    ) : (
                        "Save Contact"
                    )}
                </Button>
            </form>
        </div>
    );
}
