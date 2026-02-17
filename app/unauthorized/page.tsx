"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md">
        <Card className="shadow-lg text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <ShieldX className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-serif">
              Access Denied
            </CardTitle>
            <CardDescription className="text-base">
              You do not have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push("/")}
              className="w-full"
              size="lg">
              <Home className="mr-2 h-4 w-4" />
              Go to Home Page
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

