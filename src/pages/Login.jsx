import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, User, Phone, CheckCircle2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import CityAutocomplete from "@/components/CityAutocomplete";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NtrpRatingSelect } from "@/components/NtrpRatingField";

const VALUE_PROPS = [
  "Challenge players and climb the rankings",
  "Dynamic ladder that rewards performance",
  "Meet local players at your skill level",
  "Every match counts toward your standing",
  "Play on your schedule—no leagues or weekly commitments",
  "Compete, improve, and earn your spot at the top",
  "Join for just $25 a season - your contribution supports these charities",
];

const CHARITIES = [
  { src: "/aceing-autism.png", alt: "ACEing Autism", href: "https://aceingautism.org/" },
  { src: "/move-united.png", alt: "Move United", href: "https://moveunitedsport.org/" },
  { src: "/so-chabe-foundation.webp", alt: "So Chabe Foundation", href: "https://sochabe.org/" },
];

const STATE = "New York";

function formatRaised(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

function NavyPanel() {
  return (
    <aside className="relative shrink-0 overflow-hidden bg-[#0d1526] px-6 py-10 md:w-[35%] md:min-w-[420px] md:max-w-[640px] md:px-11 md:py-14 flex flex-col">
      <img
        src="/BPW_OptionA_NormalA_UseOnDark_1200x400_transparent.png"
        alt="Breakpoint Westchester"
        className="relative mb-8 h-auto w-3/4 self-start object-contain"
      />

      <div className="relative mt-4 max-w-[560px]">
        <h2 className="text-4xl md:text-5xl font-bold text-white">Play. Compete. Climb.</h2>
        <p className="mt-3 text-lg text-white/75">
          Break Point Ladders is the easiest way to find competitive tennis matches in your area.
        </p>
        <ul className="mt-5 space-y-3">
          {VALUE_PROPS.map((item) => (
            <li key={item} className="flex items-start gap-3 text-lg text-white/70">
              <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#6ee06a]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="relative mt-6 flex items-center gap-3">
          {CHARITIES.map((c) => (
            <a
              key={c.alt}
              href={c.href || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-24 flex-1 items-center justify-center rounded-lg bg-white p-3 transition-opacity hover:opacity-90"
            >
              <img src={c.src} alt={c.alt} className="max-h-full max-w-full object-contain" />
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function Login() {
  const [mode, setMode] = useState("signin");

  // Sign-in fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign-up fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [ntrpRating, setNtrpRating] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalRaised, setTotalRaised] = useState(0);

  useEffect(() => {
    supabase.rpc("get_total_raised").then(({ data, error: rpcError }) => {
      if (!rpcError && typeof data === "number") setTotalRaised(data);
    });
  }, []);

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

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

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name");
      return;
    }
    if (!gender) {
      setError("Please select your gender");
      return;
    }
    if (!city.trim()) {
      setError("Please select a valid Westchester municipality");
      return;
    }
    if (!ntrpRating) {
      setError("Please select your NTRP self-rating");
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            gender,
            location: `${city.trim()}, ${STATE}`,
            city: city.trim(),
            state: STATE,
            phone: phone.trim(),
            ntrp_rating: ntrpRating,
          },
        },
      });
      if (signUpError) throw signUpError;
      setConfirmationSent(true);
    } catch (err) {
      setError(err.message || "Registration failed");
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

  if (confirmationSent) {
    return (
      <div className="flex flex-col md:flex-row md:min-h-screen">
        <NavyPanel />
        <main className="flex flex-1 items-center justify-center bg-[#f7f7f5] px-6 py-10 md:p-10">
          <div className="w-full max-w-[380px] text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-[#2f9e57]" />
            <h1 className="text-2xl font-extrabold text-[#111]">Check your email</h1>
            <p className="mt-2 text-sm text-[#666]">We sent a confirmation link to {signupEmail}</p>
            <p className="mt-4 text-sm text-[#666]">
              Click the link in the email to confirm your account. You'll be signed in automatically.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:min-h-screen">
      <NavyPanel />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#f7f7f5] pl-6 pr-14 py-10 md:pl-10 md:pr-28 md:py-10">
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
              {formatRaised(totalRaised)}
            </div>
          </div>

          {mode === "signin" ? (
            <>
              <div className="text-[11px] font-extrabold tracking-[.12em] text-[#2f9e57]">SIGN IN</div>
              <h1 className="mt-2.5 text-2xl font-extrabold text-[#111]">Welcome back</h1>
              <p className="mt-1 text-sm text-[#666]">Log in to your account</p>
            </>
          ) : (
            <>
              <div className="text-[11px] font-extrabold tracking-[.12em] text-[#2f9e57]">SIGN UP</div>
              <h1 className="mt-2.5 text-2xl font-extrabold text-[#111]">Create your account</h1>
              <p className="mt-1 text-sm text-[#666]">Sign up to get started</p>
            </>
          )}

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

          {mode === "signin" ? (
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
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="mb-1.5 block text-sm font-semibold text-[#333]">
                    First name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
                    <input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      autoFocus
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#e2e2e0] py-2.5 pl-9 pr-3 text-sm text-[#111] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#2f9e57]"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-1.5 block text-sm font-semibold text-[#333]">
                    Last name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
                    <input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#e2e2e0] py-2.5 pl-9 pr-3 text-sm text-[#111] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#2f9e57]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#333]">Gender</label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="h-[42px]">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="signupEmail" className="mb-1.5 block text-sm font-semibold text-[#333]">
                  Email
                </label>
                <input
                  id="signupEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#e2e2e0] px-3 py-2.5 text-sm text-[#111] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#2f9e57]"
                />
              </div>

              <CityAutocomplete value={city} onChange={setCity} required />

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-[#333]">
                  Phone (optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
                  <input
                    id="phone"
                    type="tel"
                    placeholder="(555) 555-5555"
                    value={phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      let formatted = digits;
                      if (digits.length >= 7) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                      else if (digits.length >= 4) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                      else if (digits.length >= 1) formatted = `(${digits}`;
                      setPhone(formatted);
                    }}
                    className="w-full rounded-lg border border-[#e2e2e0] py-2.5 pl-9 pr-3 text-sm text-[#111] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#2f9e57]"
                  />
                </div>
              </div>

              <NtrpRatingSelect value={ntrpRating} onValueChange={setNtrpRating} />

              <div>
                <label htmlFor="signupPassword" className="mb-1.5 block text-sm font-semibold text-[#333]">
                  Password
                </label>
                <input
                  id="signupPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#e2e2e0] px-3 py-2.5 text-sm text-[#111] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#2f9e57]"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-[#333]">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>
          )}

          {mode === "signin" ? (
            <p className="mt-4 text-center text-sm text-[#666]">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-bold text-[#2f9e57] hover:underline"
              >
                Create one
              </button>
            </p>
          ) : (
            <p className="mt-4 text-center text-sm text-[#666]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-bold text-[#2f9e57] hover:underline"
              >
                Log in
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
