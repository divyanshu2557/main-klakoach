import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { useSession } from "../store";

type Props = { open: boolean; onClose: () => void; onLogin: (role: string) => void };

type Mode = "portal" | "login" | "register";

export function LoginModal({ open, onClose, onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("portal");
  const [selectedRole, setSelectedRole] = useState<"CUSTOMER" | "ARTISAN">("CUSTOMER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setSession } = useSession();

  if (!open) return null;

  const portals = [
    { role: "CUSTOMER" as const, title: "Collector", desc: "Wishlist, checkout, reviews, and order tracking.", icon: "◎" },
    { role: "ARTISAN" as const, title: "Artisan Studio", desc: "Manage your products, inventory, and profile.", icon: "✦" },
  ];

  const demoCredentials = {
    CUSTOMER: { email: "collector@klakoach.local", password: "Customer@1234" },
    ARTISAN: { email: "meera@klakoach.local", password: "Artisan@1234" },
    ADMIN: { email: "admin@klakoach.local", password: "Admin@1234" },
  } as const;

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const data = await api.auth.login({ email, password });
      setSession(data.accessToken, data.role, data.artisanId);
      onLogin(data.role.toLowerCase());
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setError(""); setLoading(true);
    try {
      await api.auth.register({ email, password, name, kind: selectedRole, studioName: selectedRole === "ARTISAN" ? studioName : undefined });
      await handleLogin();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: keyof typeof demoCredentials) => {
    setError("");
    setLoading(true);
    try {
      const creds = demoCredentials[role];
      const data = await api.auth.login({ email: creds.email, password: creds.password });
      setSession(data.accessToken, data.role, data.artisanId);
      onLogin(data.role.toLowerCase());
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-100 grid place-items-center overflow-y-auto bg-[#1a1510]/80 px-5 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] backdrop-blur-2xl"
      role="dialog" aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 30, scale: 0.97 }} animate={{ y: 0, scale: 1 }}
        className="w-full max-w-md overflow-hidden rounded-4xl border border-[#d4c5a9]/10 bg-[#1a1510] text-white shadow-2xl"
      >
        <div className="p-8">
          <div className="flex items-center justify-between">
            <div>
              {mode !== "portal" && (
                <button onClick={() => { setMode("portal"); setError(""); }} className="mb-2 text-xs text-[#d4c5a9]/40 hover:text-[#d4c5a9]/70">
                  ← Back
                </button>
              )}
              <p className="text-xs uppercase tracking-[0.3em] text-[#d4c5a9]/40">
                {mode === "portal" ? "Welcome back" : mode === "login" ? "Sign in" : "Create account"}
              </p>
              <h3 className="mt-2 font-serif text-3xl tracking-tight text-[#e8dcc4]">
                {mode === "portal" ? "Sign in to klakoach" : mode === "login" ? `${selectedRole === "CUSTOMER" ? "Collector" : "Artisan"} Portal` : "Join klakoach"}
              </h3>
            </div>
            <button onClick={onClose} className="rounded-full border border-[#d4c5a9]/15 px-4 py-2 text-sm text-[#d4c5a9]/60 hover:border-[#d4c5a9]/30">
              Close
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === "portal" && (
              <motion.div key="portal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 grid gap-3">
                {portals.map((p) => (
                  <button
                    key={p.role}
                    onClick={() => { setSelectedRole(p.role); setMode("login"); }}
                    className="rounded-2xl border border-[#d4c5a9]/10 bg-[#2a2218] p-4 text-left transition hover:border-[#d4c5a9]/30 hover:bg-[#332b1f]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl text-[#d4a843]">{p.icon}</span>
                      <div>
                        <p className="font-medium text-[#e8dcc4]">{p.title}</p>
                        <p className="mt-0.5 text-sm text-[#d4c5a9]/50">{p.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => handleDemoLogin("ADMIN")}
                  className="rounded-2xl border border-[#d4c5a9]/10 bg-[#2a2218] p-4 text-left transition hover:border-[#d4c5a9]/30 hover:bg-[#332b1f]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl text-[#d4a843]">♦</span>
                    <div>
                      <p className="font-medium text-[#e8dcc4]">Admin Command</p>
                      <p className="mt-0.5 text-sm text-[#d4c5a9]/50">Full platform control and analytics. (Demo)</p>
                    </div>
                  </div>
                </button>
              </motion.div>
            )}

            {(mode === "login" || mode === "register") && (
              <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mt-8 space-y-3">
                {mode === "register" && (
                  <input
                    className="w-full rounded-2xl border border-[#d4c5a9]/15 bg-[#2a2218] px-5 py-3.5 text-sm text-[#e8dcc4] outline-none placeholder:text-[#d4c5a9]/30 focus:border-[#d4c5a9]/40"
                    placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
                  />
                )}
                {mode === "register" && selectedRole === "ARTISAN" && (
                  <input
                    className="w-full rounded-2xl border border-[#d4c5a9]/15 bg-[#2a2218] px-5 py-3.5 text-sm text-[#e8dcc4] outline-none placeholder:text-[#d4c5a9]/30 focus:border-[#d4c5a9]/40"
                    placeholder="Studio name" value={studioName} onChange={(e) => setStudioName(e.target.value)}
                  />
                )}
                <input
                  type="email"
                  className="w-full rounded-2xl border border-[#d4c5a9]/15 bg-[#2a2218] px-5 py-3.5 text-sm text-[#e8dcc4] outline-none placeholder:text-[#d4c5a9]/30 focus:border-[#d4c5a9]/40"
                  placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  className="w-full rounded-2xl border border-[#d4c5a9]/15 bg-[#2a2218] px-5 py-3.5 text-sm text-[#e8dcc4] outline-none placeholder:text-[#d4c5a9]/30 focus:border-[#d4c5a9]/40"
                  placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
                />
                {mode === "login" && (
                  <div className="flex justify-end pt-1 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        const creds = demoCredentials[selectedRole];
                        setEmail(creds.email);
                        setPassword(creds.password);
                      }}
                      className="text-xs text-[#d4a843] hover:text-[#e8b84e] transition-colors underline cursor-pointer"
                    >
                      ✦ Autofill demo credentials
                    </button>
                  </div>
                )}
                {error && <p className="rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}
                <button
                  onClick={mode === "login" ? handleLogin : handleRegister}
                  disabled={loading}
                  className="w-full rounded-full bg-[#d4c5a9] py-3.5 text-sm font-semibold text-[#1a1510] transition hover:bg-[#e8dcc4] disabled:opacity-50"
                >
                  {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                </button>
                <p className="text-center text-sm text-[#d4c5a9]/40">
                  {mode === "login" ? "No account?" : "Already have one?"}{" "}
                  <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="text-[#d4c5a9]/70 underline hover:text-[#e8dcc4]">
                    {mode === "login" ? "Register" : "Sign in"}
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
