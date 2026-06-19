import Link from "next/link";
import { redirect } from "next/navigation";
import { RiArrowLeftLine } from "@remixicon/react";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth/session";

export default async function SignInPage() {
  const session = await getSession();
  if (session?.user) redirect("/app/tickets");

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      {/* Left Column - Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-950 p-10 text-white w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary/30 to-background/10 z-0" />

        {/* Abstract shapes for background decoration */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50"></div>
        <div className="absolute -left-40 -top-40 size-96 bg-primary/20 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -right-20 -bottom-20 size-80 bg-primary/10 rounded-full blur-3xl opacity-50"></div>

        <Link href="/" className="relative z-10 flex items-center text-xl font-bold tracking-tight">
          <img src="/android-chrome-512x512.png" alt="SalamDesk Logo" className="mr-3 size-10 rounded-xl shadow-lg ring-1 ring-white/10" />
          SalamDesk
        </Link>
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
            <Link href="/" className="flex lg:hidden items-center mb-6 text-xl font-bold">
              <img src="/android-chrome-512x512.png" alt="SalamDesk Logo" className="mr-3 size-10 rounded-xl" />
              SalamDesk
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          <LoginForm />

          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Need access? Contact your SalamDesk admin.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RiArrowLeftLine className="size-3" />
              Kembali ke beranda
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
