"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  ChevronLeft,
  Command,
  Globe,
  LayoutGrid,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

// --- Configuration ---
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type AuthView = "LOGIN" | "FORGOT";

// --- Components ---

function BrandPattern() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden opacity-30 dark:opacity-20">
      <div className="absolute -left-[10%] -top-[10%] h-[120%] w-[120%] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
    </div>
  );
}

function StatusBadge() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/50 px-3 py-1 text-[11px] font-medium text-zinc-600 backdrop-blur-md transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 cursor-help" title="All systems operational">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
      </span>
      Systems Operational
    </div>
  );
}

// --- Main Page ---

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/superadmin";

  const { user, login } = useAuthStore();
  const isHydrated = useAuthStore((s) => s._hasHydrated);
  const [view, setView] = React.useState<AuthView>("LOGIN");

  // Form State
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(false);

  // UX State
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ✅ FIXED: Centralized Redirect Logic
  // This hook now acts as the SINGLE source of truth for navigation.
  React.useEffect(() => {
    if (isHydrated && user) {
      if (user.mustChangePassword) {
        // Safe cast
        router.replace(`/must-change-password?next=${encodeURIComponent(next)}` as any);
      } else {
        router.replace(next as any);
      }
    }
  }, [user, isHydrated, router, next]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Invalid credentials.");

      const accessToken = (data as any)?.access_token;
      const loggedInUser = (data as any)?.user;

      if (accessToken) {
        if (remember) localStorage.setItem("access_token", accessToken);
        else sessionStorage.setItem("access_token", accessToken);
      }

      if (loggedInUser) {
        // 1. Update store
        login(loggedInUser, accessToken ?? null);

        // 2. HARD REDIRECT to break the loop and ensure middleware sees cookies
        const target = loggedInUser.mustChangePassword
           ? `/must-change-password?next=${encodeURIComponent(next)}`
           : next;
        
        window.location.href = target;
        return; // Stop here
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      
      {/* --- LEFT PANEL: Brand (67%) --- */}
      <div className="relative hidden w-2/3 flex-col justify-between border-r border-zinc-200 bg-zinc-50 p-16 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white lg:flex">
        <BrandPattern />
        
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold tracking-tight">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 dark:bg-indigo-500 dark:shadow-indigo-500/30">
              <Command className="h-6 w-6" />
            </div>
            <div className="text-xl">
              ExcelCare<span className="font-normal text-zinc-500 dark:text-zinc-400">OS</span>
            </div>
          </div>
          <StatusBadge />
        </div>

        {/* Center Hero */}
        <div className="relative z-10 max-w-2xl">
          <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-[2rem] bg-white shadow-xl shadow-zinc-200/50 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:shadow-black/50 dark:ring-zinc-700">
            <LayoutGrid className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="mb-6 text-5xl font-semibold leading-tight tracking-tight">
            The Operating System for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Modern Healthcare.
            </span>
          </h1>
          <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Unified clinical workflows, billing, and patient data in one secure enterprise environment. Designed for speed, compliance, and reliability.
          </p>
          
          <div className="mt-8 flex gap-4">
            <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
               <ShieldCheck className="h-4 w-4 text-emerald-500" />
               HIPAA Compliant
            </div>
            <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
               <Lock className="h-4 w-4 text-emerald-500" />
               SOC2 Type II Ready
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-zinc-400 dark:text-zinc-500">
           © 2026 ExcelCare Systems Inc. • Enterprise Build v4.2.0
        </div>
      </div>

      {/* --- RIGHT PANEL: Auth (33%) --- */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-white p-8 dark:bg-zinc-950 lg:w-1/3 lg:flex-none">
        
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[360px] space-y-8">
          
          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {view === "LOGIN" && "Welcome back"}
              {view === "FORGOT" && "Reset Password"}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {view === "LOGIN" && "Enter your credentials to access the workspace."}
              {view === "FORGOT" && "We'll send a recovery link to your email."}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 p-4 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400 animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {/* --- VIEW: LOGIN --- */}
          {view === "LOGIN" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Email Address</label>
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400 transition group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400" />
                    <Input 
                        placeholder="name@hospital.com" 
                        type="email" 
                        className="pl-9 h-11 bg-zinc-50 border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500/20 dark:bg-zinc-900 dark:border-zinc-800 dark:focus:border-indigo-400"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                   <div className="flex items-center justify-between">
                     <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Password</label>
                     <button type="button" onClick={() => setView("FORGOT")} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                        Forgot password?
                     </button>
                   </div>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400 transition group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400" />
                    <Input 
                        placeholder="••••••••" 
                        type="password" 
                        className="pl-9 h-11 bg-zinc-50 border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500/20 dark:bg-zinc-900 dark:border-zinc-800 dark:focus:border-indigo-400"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-zinc-500 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800" 
                  />
                  Remember device
                </label>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-11 text-base font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 dark:bg-indigo-600 dark:hover:bg-indigo-500">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><Separator className="w-full border-zinc-200 dark:border-zinc-800" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold"><span className="bg-white px-2 text-zinc-400 dark:bg-zinc-950">Or continue with</span></div>
              </div>

              <Button type="button" variant="outline" className="w-full h-11 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <Building2 className="mr-2 h-4 w-4 text-zinc-400" />
                Enterprise SSO
              </Button>
            </form>
          )}

           {/* --- VIEW: FORGOT PASSWORD --- */}
           {view === "FORGOT" && (
            <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Email Address</label>
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input placeholder="Enter your email" type="email" className="pl-9 h-11 bg-zinc-50 dark:bg-zinc-900" />
                  </div>
               </div>
               
               <div className="space-y-3">
                   <Button className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white">Send Reset Link</Button>
                   <Button variant="ghost" onClick={() => setView("LOGIN")} className="w-full h-11 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to Login
                   </Button>
               </div>
            </div>
           )}

        </div>

        {/* Footer Links (Right Side) */}
        <div className="absolute bottom-6 left-0 w-full text-center">
          <div className="flex justify-center gap-6 text-xs font-medium text-zinc-400 dark:text-zinc-600">
            <a href="#" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Terms of Service</a>
            <a href="#" className="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">
              <Globe className="h-3 w-3" /> Help Center
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}