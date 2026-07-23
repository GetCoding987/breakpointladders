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

        <div className="relative text-[11px] font-extrabold tracking-[.14em] text-[#6ee06a]">
          LADDER LOGIN
        </div>

        <div className="relative mt-4 max-w-[380px]">
          <h2 className="text-xl md:text-2xl font-bold text-white">Play. Compete. Climb.</h2>
          <p className="mt-2 text-sm text-white/75">
            BreakPoint Ladders is the easiest way to find competitive tennis matches in your area.
          </p>
          <ul className="mt-4 space-y-2">
            {VALUE_PROPS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6ee06a]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="relative my-7 h-px"
          style={{ background: "linear-gradient(90deg, #6ee06a, rgba(110,224,106,0))" }}
        />

        <div className="relative">
          <div className="text-[15px] font-semibold text-white">
            Every entry fee supports three charities.
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {PLACEHOLDER_CHARITIES.map((name) => (
              <span
                key={name}
                className="inline-flex items-center whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mt-8 pt-6 md:mt-auto">
          <div className="text-[11px] font-extrabold tracking-[.12em] text-[#6ee06a]">
            RAISED FOR CHARITY
          </div>
          <div className="mt-2 text-4xl font-extrabold tabular-nums text-white">
            {totalRaisedDisplay}
          </div>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-[#f7f7f5] px-6 py-10 md:p-10">
        <div className="w-full max-w-[380px]">
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
