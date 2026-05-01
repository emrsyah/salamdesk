"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RiArrowLeftLine, RiUserAddLine } from "@remixicon/react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = await authClient.signUp.email({
      email,
      password,
      name,
      role: "reporter",
      vendor: "",
      isActive: true,
      callbackURL: "/app/tickets",
    });

    if (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } else {
      router.push("/app/tickets");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6 bg-linear-to-b from-background to-muted/20">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="relative mb-4">
             <div className="absolute -inset-1 bg-linear-to-r from-primary to-primary/50 rounded-2xl blur-sm opacity-25" />
             <img src="/android-chrome-512x512.png" alt="SalamDesk Logo" className="relative size-16 rounded-2xl" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground text-center">
            Join SalamDesk and start managing your customer support more efficiently.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? (
              "Creating account..."
            ) : (
              <>
                <RiUserAddLine className="size-4" />
                Register
              </>
            )}
          </Button>
        </form>

        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/" className="font-medium text-primary hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
          
          <Link 
            href="/" 
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RiArrowLeftLine className="size-3" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
