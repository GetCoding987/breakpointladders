import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

const VALUE_PROPS = [
  "Challenge players and climb the rankings",
  "Dynamic ladder that rewards performance",
  "Meet local players at your skill level",
  "Every match counts toward your standing",
  "Play on your schedule—no leagues or weekly commitments",
  "Compete, improve, and earn your spot at the top",
];

const PLACEHOLDER_CHARITIES = ["Aces for Autism", "Youth Grand Slam Fund", "Serve the Community"];

const TOTAL_RAISED = 0;
const totalRaisedDisplay = TOTAL_RAISED.toLocaleString("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
});

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
  };

  return (
    <div className="flex flex-col md:flex-row md:min-h-screen">
      <aside className="relative shrink-0 overflow-hidden bg-[#0d1526] px-6 py-10 md:w-[420px] lg:w-[480px] md:px-11 md:py-14 flex flex-col">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, transparent 1px 130px)",
          }}
        />

        <div className="relative mb-8 self-start">
          <div className="flex items-center gap-2.5">
            <span className="text-4xl font-extrabold tracking-wide text-white">BREAK</span>
            <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#c9e61f" />
              <path d="M12 1 C 6.5 6, 6.5 18, 12 23" fill="none" stroke="#fff" strokeWidth="1.4" />
              <path d="M12 1 C 17.5 6, 17.5 18, 12 23" fill="none" stroke="#fff" strokeWidth="1.4" />
            </svg>
            <span className="text-4xl font-extrabold tracking-wide text-white">POINT</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#6ee06a]" />
            <span className="text-xl font-bold tracking-[.25em] text-[#6ee06a]">WESTCHESTER</span>
            <span className="h-px flex-1 bg-[#6ee06a]" />
          </div>
        </div>

        <div className="relative mt-8 text-sm font-extrabold tracking-[.14em] text-[#6ee06a]">
          LADDER LOGIN
        </div>

        <div className="relative mt-4 max-w-[420px]">
          <h2 className="text-3xl md:text-4xl font-bold text-white">Play. Compete. Climb.</h2>
          <p className="mt-3 text-base text-white/75">
            BreakPoint Ladders is the easiest way to find competitive tennis matches in your area.
          </p>
          <ul className="mt-5 space-y-2.5">
            {VALUE_PROPS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-base text-white/70">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6ee06a]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-28">
          <div className="text-lg font-semibold text-white">
            Every entry fee supports three charities.
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {PLACEHOLDER_CHARITIES.map((name) => (
              <span
                key={name}
                className="inline-flex items-center whitespace-nowrap rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

      </aside>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#f7f7f5] px-6 py-10 md:p-10">
        <svg
          className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 md:-right-16 md:-top-32 md:h-96 md:w-96"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="11" fill="#c9e61f" />
          <path d="M12 1 C 6.5 6, 6.5 18, 12 23" fill="none" stroke="#fff" strokeWidth="0.6" />
          <path d="M12 1 C 17.5 6, 17.5 18, 12 23" fill="none" stroke="#fff" strokeWidth="0.6" />
        </svg>

        <div className="w-full max-w-[380px]">
          <div className="relative z-10 mb-6 ml-auto w-fit rounded-2xl bg-white px-6 py-5 text-right shadow-lg md:absolute md:left-[calc(100%-144px)] md:top-24 md:mb-0 md:ml-0 md:w-64 md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="text-sm font-extrabold tracking-[.12em] text-[#2f9e57]">
              RAISED FOR CHARITY
            </div>
            <div className="mt-1 text-6xl font-extrabold tabular-nums text-[#111]">
              {totalRaisedDisplay}
            </div>
          </div>

          <div className="text-[11px] font-extrabold tracking-[.12em] text-[#2f9e57]">SIGN IN</div>
          <h1 className="mt-2.5 text-2xl font-extrabold text-[#111]">Welcome back</h1>
          <p className="mt-1 text-sm text-[#666]">Log in to your account</p>

          <button
            type="button"
            onClick={handleGoogle}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#e2e2e0] bg-white py-3 text-sm font-semibold text-[#222]"
          >
            <GoogleIcon className="h-[18px] w-[18px]" />
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-[11px] font-semibold text-[#999]">
            <div className="h-px flex-1 bg-[#e5e5e3]" />
            OR
            <div className="h-px flex-1 bg-[#e5e5e3]" />
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[#333]">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[#e2e2e0] px-3 py-2.5 text-sm text-[#111] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#2f9e57]"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-semibold text-[#333]">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-[#2f9e57] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-[#e2e2e0] px-3 py-2.5 text-sm text-[#111] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#2f9e57]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0d1526] py-3 text-sm font-bold text-white disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Log in"
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-[#666]">
            Don't have an account?{" "}
            <Link to="/register" className="font-bold text-[#2f9e57] hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
