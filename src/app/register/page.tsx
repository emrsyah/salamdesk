"use client";

import { useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    setError("Akses SalamDesk saat ini menggunakan undangan admin. Hubungi admin ITSM untuk dibuatkan akun.");

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

      {/* Right Column - Register Form */}
      <div className="flex flex-col justify-center items-center p-8 w-full lg:w-1/2 bg-background">
        <div className="w-full max-w-[380px] space-y-8">
          <div className="flex flex-col space-y-2">
            <div className="flex lg:hidden items-center mb-6 text-xl font-bold">
              <img src="/android-chrome-512x512.png" alt="SalamDesk Logo" className="mr-3 size-10 rounded-xl" />
              SalamDesk
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
            <p className="text-sm text-muted-foreground">
              Akun staf dibuat melalui undangan admin ITSM.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="bg-muted/50"
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
                className="bg-muted/50"
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
                className="bg-muted/50"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full gap-2 text-base py-5" disabled={loading}>
              {loading ? (
                "Creating account..."
              ) : (
                <>
                  <RiUserAddLine className="size-5" />
                  Request access
                </>
              )}
            </Button>
          </form>

          <div className="text-center space-y-4 mt-6">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-primary hover:underline underline-offset-4">
                Sign in
              </Link>
            </p>
            
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
              <RiArrowLeftLine className="size-3" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
