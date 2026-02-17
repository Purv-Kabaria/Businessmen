"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  LogIn,
  LogOut,
  ArrowLeft,
  LayoutDashboard,
  Moon,
  Sun,
  Loader2,
  Edit,
  Trash2,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  fullName?: string;
  [key: string]: unknown;
}

const updateUserSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
});

function canAccessRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    USER: 1,
    MODERATOR: 2,
    ADMIN: 3,
  };
  return (
    (roleHierarchy[userRole.toUpperCase()] || 0) >=
    (roleHierarchy[requiredRole.toUpperCase()] || 0)
  );
}

function UserInfoCard({
  user,
  onUserUpdate,
  variants,
  onUpdateClick,
  onDeleteClick,
  onLogoutClick,
}: {
  user: User;
  onUserUpdate: (user: User) => void;
  variants: {
    hidden: { opacity: number; y: number };
    visible: {
      opacity: number;
      y: number;
      transition: { staggerChildren: number };
    };
  };
  onUpdateClick: () => void;
  onDeleteClick: () => void;
  onLogoutClick: () => void;
}) {
  const initials = (user.fullName || user.name || user.email)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div variants={variants}>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl font-serif">
                {user.fullName || user.name}
              </CardTitle>
              <CardDescription className="text-base">
                {user.email}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Role</p>
            <p className="text-base font-semibold capitalize">
              {user.role.toLowerCase()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">User ID</p>
            <p className="text-sm font-mono text-muted-foreground">{user.id}</p>
          </div>
          <div className="space-y-2 pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onUpdateClick}>
                <Edit className="mr-2 h-4 w-4" />
                Update Profile
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={onDeleteClick}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={onLogoutClick}>
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function UserPage() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { checkAuth, logout } = useAuthStore();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
    },
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/user/read");
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const userData = {
              ...result.data,
              name: result.data.fullName || result.data.name,
            } as User;
            setUser(userData);
            form.reset({
              fullName: result.data.fullName || "",
              email: result.data.email || "",
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch user", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [form]);

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const onUpdateSubmit = async (values: z.infer<typeof updateUserSchema>) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/user/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message || "Failed to update profile.");
        return;
      }

      if (result.success) {
        toast.success("Profile updated successfully!");
        const updatedUser = {
          ...result.data,
          name: result.data.fullName || result.data.name,
        } as User;
        setUser(updatedUser);
        await checkAuth();
        setIsUpdateDialogOpen(false);
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message || "Failed to delete account.");
        setIsDeleting(false);
        return;
      }

      if (result.success) {
        toast.success("Your account has been deleted successfully.");
        await logout();
        router.push("/");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully!");
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("An unexpected error occurred during logout.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You must be logged in to view this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")}>
              <LogIn className="mr-2 h-4 w-4" /> Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
  };

  return (
    <main className="min-h-screen bg-secondary p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb className="mb-4 sm:mb-6">
          <BreadcrumbList className="text-xs sm:text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>User Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <motion.div
          className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
          variants={cardVariants}
          initial="hidden"
          animate="visible">
          {/* Left Side: User Profile */}
          <UserInfoCard
            user={user}
            onUserUpdate={handleUserUpdate}
            variants={cardVariants}
            onUpdateClick={() => setIsUpdateDialogOpen(true)}
            onDeleteClick={() => setIsDeleteDialogOpen(true)}
            onLogoutClick={handleLogout}
          />

          {/* Right Side: Links & Settings */}
          <motion.div
            variants={cardVariants}
            className="flex flex-col justify-between gap-6 lg:gap-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-serif">
                  Quick Links
                </CardTitle>
                <CardDescription>
                  Navigate to other parts of the application.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canAccessRole(user.role, "admin") ? (
                  <Link href="/admin">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-base h-12">
                      <LayoutDashboard className="mr-3 h-5 w-5 text-primary" />
                      Go to Admin Panel
                    </Button>
                  </Link>
                ) : canAccessRole(user.role, "moderator") ? (
                  <Link href="/moderator">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-base h-12">
                      <LayoutDashboard className="mr-3 h-5 w-5 text-primary" />
                      Go to Moderator Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Link href="/user">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-base h-12">
                      <LayoutDashboard className="mr-3 h-5 w-5 text-primary" />
                      Go to User Dashboard
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-serif">Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel of the app.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="font-medium">Toggle Theme</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Update Profile Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Profile</DialogTitle>
            <DialogDescription>
              Update your profile information. You can change your name and email
              address.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        {...field}
                        disabled={isUpdating}
                      />
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                        disabled={isUpdating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUpdateDialogOpen(false)}
                  disabled={isUpdating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Profile"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot be
              undone. All your data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
