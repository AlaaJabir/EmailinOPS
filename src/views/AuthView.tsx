import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Server,
  Zap,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, register, error, clearError, isConfigured } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setFormError(null);
    clearError();
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFormError('Email address is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setFormError('Password is required.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'register') {
      if (!fullName.trim()) {
        setFormError('Full name is required.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }

      setIsSubmitting(true);
      const res = await register(cleanEmail, password, fullName.trim());
      setIsSubmitting(false);

      if (res.success) {
        if (res.message) {
          setSuccessMessage(res.message);
          setMode('login');
        }
      } else {
        setFormError(res.error || 'Registration failed');
      }
    } else {
      setIsSubmitting(true);
      const res = await login(cleanEmail, password);
      setIsSubmitting(false);

      if (!res.success) {
        setFormError(res.error || 'Invalid email or password');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#EDEDED] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans select-none">
      {/* Subtle Background Radial */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />
      
      {/* Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-sm bg-white/5 border border-white/10 mb-4">
            <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center text-black font-bold text-[10px]">
              EO
            </div>
            <span className="text-xs font-semibold text-white tracking-wide">
              EmailOps Enterprise
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-mono tracking-wider text-[#888888] uppercase">
              PROD
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'login' ? 'Sign in to EmailOps' : 'Create Operator Account'}
          </h1>
          <p className="text-xs text-[#888888] mt-1.5 max-w-sm mx-auto">
            {mode === 'login'
              ? 'Real-time telemetry and control plane for KumoMTA and Amazon SES infrastructure.'
              : 'Provision your secure administrator credentials backed by real Supabase authentication.'}
          </p>
        </div>

        {/* Configuration Notice if Supabase env vars not provided */}
        {!isConfigured && (
          <div className="mb-6 p-4 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Supabase Connection Setup</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Supabase Auth requires <code className="bg-black/40 px-1 py-0.5 rounded text-amber-100 font-mono">VITE_SUPABASE_URL</code> and{' '}
              <code className="bg-black/40 px-1 py-0.5 rounded text-amber-100 font-mono">VITE_SUPABASE_ANON_KEY</code>.
              Configure them in your environment variables to connect your live Supabase project.
            </p>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-[#0F0F0F] border border-white/10 rounded-sm p-6 shadow-2xl backdrop-blur-md">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#050505] border border-white/10 rounded-sm mb-6">
            <button
              id="tab-signin"
              type="button"
              onClick={() => switchMode('login')}
              className={`py-1.5 text-xs font-medium rounded-sm transition-all ${
                mode === 'login'
                  ? 'bg-white text-black shadow-sm font-semibold'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-register"
              type="button"
              onClick={() => switchMode('register')}
              className={`py-1.5 text-xs font-medium rounded-sm transition-all ${
                mode === 'register'
                  ? 'bg-white text-black shadow-sm font-semibold'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="leading-tight">{successMessage}</div>
            </div>
          )}

          {/* Error Alert */}
          {(formError || error) && (
            <div className="mb-4 p-3 rounded-sm bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="leading-tight flex-1">{formError || error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Vance"
                    className="w-full bg-[#050505] border border-white/10 rounded-sm pl-9 pr-3 py-2 text-xs text-white placeholder:text-[#555555] focus:outline-none focus:border-white/40 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@emailops.io"
                  className="w-full bg-[#050505] border border-white/10 rounded-sm pl-9 pr-3 py-2 text-xs text-white placeholder:text-[#555555] focus:outline-none focus:border-white/40 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-wider">
                  Password
                </label>
                {mode === 'login' && (
                  <span className="text-[10px] text-[#666666]">
                    Supabase Encrypted
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#050505] border border-white/10 rounded-sm pl-9 pr-3 py-2 text-xs text-white placeholder:text-[#555555] focus:outline-none focus:border-white/40 transition-colors"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#050505] border border-white/10 rounded-sm pl-9 pr-3 py-2 text-xs text-white placeholder:text-[#555555] focus:outline-none focus:border-white/40 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-sm transition-all shadow-md disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>{mode === 'login' ? 'Authenticating...' : 'Provisioning Account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badges */}
          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-[10px] text-[#666666]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Supabase Auth & RLS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Server className="w-3 h-3 text-[#888888]" />
              <span>KumoMTA 51.170.132.86</span>
            </div>
          </div>
        </div>

        {/* Bottom Switch Link */}
        <div className="text-center mt-6">
          <p className="text-xs text-[#888888]">
            {mode === 'login' ? "Don't have an operator account?" : 'Already have credentials?'}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="ml-2 text-white hover:underline font-medium focus:outline-none"
            >
              {mode === 'login' ? 'Create one now' : 'Sign in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
