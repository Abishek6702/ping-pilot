import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Radio,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  X,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { setAuthUser } from "../../store/slices/authSlice";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";

export default function AuthModal({
  isOpen = true,
  onClose = null,
  initialMode = "signin",
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useSelector((state) => state.theme.mode);

  const resetTokenParam = searchParams.get("resetToken");

  const [mode, setMode] = useState(resetTokenParam ? "reset" : initialMode); // 'signin' | 'register' | 'forgot' | 'reset'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    if (resetTokenParam) {
      setMode("reset");
    }
  }, [resetTokenParam]);

  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    import.meta.env.GOOGLE_CLIENT_ID ||
    "1022446873245-2lu7vuej60apgk0rql9gi0ue6ch6c64j.apps.googleusercontent.com";

  if (!isOpen) return null;

  // Direct fetch for Sign In / Registration inside this file
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mode: FORGOT PASSWORD
    if (mode === "forgot") {
      if (!email.trim()) {
        return toast.error("Please enter your email address");
      }

      setLoading(true);
      setError(null);
      setForgotSuccess(false);

      try {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: email.trim() }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to send reset link");
        }

        setForgotSuccess(true);
        toast.success(data.message || "Password reset link sent to your email");
      } catch (err) {
        setError(err.message || "Failed to send reset link");
        toast.error(err.message || "Failed to send reset link");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Mode: RESET PASSWORD WITH TOKEN
    if (mode === "reset") {
      if (!password || password.length < 8) {
        return toast.error("Password must be at least 8 characters long");
      }
      if (password !== confirmPassword) {
        return toast.error("Passwords do not match");
      }

      setLoading(true);
      setError(null);

      try {
        const token = resetTokenParam;
        const res = await fetch(`${API_URL}/auth/reset-password/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to reset password");
        }

        toast.success(data.message || "Password reset! Please sign in with your new password.");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
      } catch (err) {
        setError(err.message || "Failed to reset password");
        toast.error(err.message || "Failed to reset password");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Mode: SIGN IN or REGISTER
    if (!email || !password) {
      return toast.error("Please fill in all required fields");
    }

    if (mode === "register") {
      if (!name.trim()) {
        return toast.error("Please enter your name");
      }
      if (password.length < 8) {
        return toast.error("Password must be at least 8 characters long");
      }
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = mode === "register" ? `${API_URL}/auth/register` : `${API_URL}/auth/login`;
      const payload = mode === "register"
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      dispatch(setAuthUser({ user: data.user, token: data.token }));
      toast.success(
        mode === "register"
          ? `Account created! Welcome, ${data.user?.name || "Developer"}!`
          : `Welcome back, ${data.user?.name || "User"}!`
      );

      if (onClose) onClose();
      navigate("/");
    } catch (err) {
      setError(err.message || "Authentication failed");
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // Direct fetch for Google login inside this file
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken: credentialResponse.credential }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Google authentication failed");
      }

      dispatch(setAuthUser({ user: data.user, token: data.token }));
      toast.success(`Welcome, ${data.user?.name || "User"}!`);

      if (onClose) onClose();
      navigate("/");
    } catch (err) {
      setError(err.message || "Google sign-in failed");
      toast.error(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error("Google authentication could not be completed");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#0E7A88] flex items-center justify-center text-white shadow-lg shadow-[#0E7A88]/25 mb-3 transition-transform hover:scale-105">
            <Radio className="w-6 h-6 animate-pulse-dot" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ping<span className="text-[#0E7A88]">Pilot</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            API Health Monitoring & Keep-Alive Platform
          </p>
        </div>

        {/* Mode Switch Tabs (only visible for signin and register) */}
        {(mode === "signin" || mode === "register") && (
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/70 p-1 mb-5 border border-slate-200/60 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "signin"
                  ? "bg-white dark:bg-slate-900 text-[#0E7A88] shadow-sm font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === "register"
                  ? "bg-white dark:bg-slate-900 text-[#0E7A88] shadow-sm font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#0E7A88]" />
              Create Account
            </button>
          </div>
        )}

        {/* Subtitle */}
        <div className="mb-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {mode === "signin"
              ? "Access your personal API monitor dashboard"
              : mode === "register"
              ? "Register to keep your personal endpoints alive 24/7"
              : mode === "forgot"
              ? "Enter your email to receive a password reset link (Local accounts only)"
              : "Enter your new password below"}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Forgot Password Success Message */}
        {mode === "forgot" && forgotSuccess ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Reset Link Dispatched</p>
                <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                  If an account with <strong>{email}</strong> exists with local password authentication, we have sent a 15-minute reset link to your email.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setForgotSuccess(false);
              }}
              className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    required={mode === "register"}
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white transition-all"
                  />
                </div>
              </div>
            )}

            {/* Email field (for signin, register, forgot) */}
            {mode !== "reset" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white transition-all"
                  />
                </div>
              </div>
            )}

            {/* Password field (for signin, register, reset) */}
            {mode !== "forgot" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {mode === "reset" ? "New Password (min 8 chars)" : `Password ${mode === "register" ? "(min 8 chars)" : ""}`}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={mode === "register" || mode === "reset" ? 8 : undefined}
                    className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm password (for reset mode) */}
            {mode === "reset" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E7A88] text-slate-900 dark:text-white transition-all"
                  />
                </div>
              </div>
            )}

            {/* Remember Me & Forgot Password Link */}
            {mode === "signin" && (
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded-sm text-[#0E7A88] border-slate-300 dark:border-slate-700 focus:ring-[#0E7A88]"
                  />
                  Remember device
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                  }}
                  className="text-xs font-semibold text-[#0E7A88] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#0E7A88] hover:bg-[#0b6672] active:bg-[#084d56] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#0E7A88]/20 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === "signin"
                      ? "Sign In"
                      : mode === "register"
                      ? "Create Account"
                      : mode === "forgot"
                      ? "Send Reset Link"
                      : "Save New Password"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Back to sign in for forgot or reset modes */}
            {(mode === "forgot" || mode === "reset") && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer font-medium"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* Google OAuth Login Button (only for signin and register) */}
        {(mode === "signin" || mode === "register") && (
          <>
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-semibold">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center w-full">
              <GoogleOAuthProvider clientId={googleClientId}>
                <div className="w-full flex justify-center [&>div]:w-full [&>div>iframe]:mx-auto">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme={theme === "dark" ? "filled_black" : "outline"}
                    shape="rectangular"
                    size="large"
                    text={mode === "register" ? "signup_with" : "continue_with"}
                    width="384"
                    logo_alignment="center"
                  />
                </div>
              </GoogleOAuthProvider>
            </div>
          </>
        )}

        {/* Footnote */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0E7A88]" />
          <span>SSRF Protected • Multi-Tenant Isolated</span>
        </div>
      </div>
    </div>
  );
}
