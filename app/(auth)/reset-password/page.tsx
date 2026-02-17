"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const otpSchema = z.object({
  otp: z.string().min(6, { message: "OTP must be 6 characters." }),
});

const passwordValidation = new RegExp(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
);

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(100, "Password is too long.")
      .regex(passwordValidation, "Password does not meet requirements."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [step, setStep] = useState<"otp" | "password">("otp");
  const [isLoading, setIsLoading] = useState(false);

  const [verifiedOtp, setVerifiedOtp] = useState<string | null>(null);

  useEffect(() => {
    if (!email) {
      toast.error("Missing email information.");
      // Optional: redirect to forgot password
      // router.push("/forgot-password");
    }
  }, [email, router]);

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onOtpSubmit(values: z.infer<typeof otpSchema>) {
    setIsLoading(true);
    try {
      // No server call here; OTP will be verified during password reset
      setVerifiedOtp(values.otp);
      setStep("password");
      toast.success("Code captured. Please set a new password.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onPasswordSubmit(values: z.infer<typeof passwordSchema>) {
    if (!verifiedOtp || !email) {
      toast.error("Missing OTP or email.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token: verifiedOtp,
          password: values.password,
          confirmPassword: values.confirmPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        toast.error(result.error?.message || "Failed to reset password.");
        return;
      }
      toast.success("Password reset successfully! Please log in.");
      router.push("/login");
    } catch (e) {
      console.error(e);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const motionVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
  };

  if (!email) return null;

  return (
    <Card className="w-full max-w-md bg-card text-card-foreground shadow-lg overflow-hidden">
      <AnimatePresence mode="wait">
        {step === "otp" && (
          <motion.div
            key="otp-step"
            variants={motionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">
                Enter Verification Code
              </CardTitle>
              <CardDescription className="text-center">
                Enter the 6-digit code sent to {email}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...otpForm}>
                <form
                  onSubmit={otpForm.handleSubmit(onOtpSubmit)}
                  className="space-y-6">
                  <FormField
                    control={otpForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormLabel className="sr-only">OTP Code</FormLabel>
                        <FormControl>
                          <InputOTP
                            maxLength={6}
                            {...field}
                            disabled={isLoading}>
                            <InputOTPGroup>
                              {[...Array(6)].map((_, i) => (
                                <InputOTPSlot key={i} index={i} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Verify Code"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </motion.div>
        )}

        {step === "password" && (
          <motion.div
            key="password-step"
            variants={motionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">
                Set New Password
              </CardTitle>
              <CardDescription className="text-center pb-6">
                Please enter your new password below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                  className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            maxLength={100}
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            maxLength={100}
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Suspense
        fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
