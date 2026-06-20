import Link from "next/link";
import { redirect } from "next/navigation";
import { RiArrowLeftLine } from "@remixicon/react";
import { LoginForm } from "./login-form";
import { TestimonialPanel } from "./testimonial-panel";
import { getSession } from "@/lib/auth/session";

export default async function SignInPage() {
  const session = await getSession();
  if (session?.user) redirect("/app/tickets");

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <TestimonialPanel />

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
