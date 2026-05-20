"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = await authClient.signIn.email({
      email,
      password,
    });

    if (err) {
      setError("Invalid email or password.");
    } else {
      router.push("/app/tickets");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      {/* Left Column - Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-950 p-10 text-white w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary/30 to-background/10 z-0" />
        
        {/* Abstract shapes for background decoration */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50"></div>
        <div className="absolute -left-40 -top-40 size-96 bg-primary/20 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -right-20 -bottom-20 size-80 bg-primary/10 rounded-full blur-3xl opacity-50"></div>

        <div className="relative z-10 flex items-center text-xl font-bold tracking-tight">
          <img src="/android-chrome-512x512.png" alt="SalamDesk Logo" className="mr-3 size-10 rounded-xl shadow-lg ring-1 ring-white/10" />
          SalamDesk
        </div>
        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-4xl font-bold tracking-tight leading-tight">AI-Powered Helpdesk for SIMRS.</h2>
          <p className="text-lg text-zinc-300">
            Streamline hospital operations, resolve IT issues faster, and empower your healthcare staff with intelligent ticketing and AI-driven support.
          </p>
        </div>
        <div className="relative z-10 text-sm text-zinc-500">
          © {new Date().getFullYear()} SalamDesk. All rights reserved.
        </div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex flex-col justify-center items-center p-8 w-full lg:w-1/2 bg-background">
        <div className="w-full max-w-[380px] space-y-8">
          <div className="flex flex-col space-y-2">
            <div className="flex lg:hidden items-center mb-6 text-xl font-bold">
              <img src="/android-chrome-512x512.png" alt="SalamDesk Logo" className="mr-3 size-10 rounded-xl" />
              SalamDesk
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-muted/50"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full text-base py-5" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Need access? Contact your SalamDesk admin.
          </p>
        </div>
      </div>
    </div>
  );
}
