import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  Unlock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  ShieldCheck, 
  AlertCircle,
  Delete,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { SecurityConfig, verifyPassword, hashPassword, generateSalt } from '../utils/security';

interface LockScreenProps {
  config: SecurityConfig;
  onUnlock: () => void;
  onSaveConfig?: (newConfig: SecurityConfig) => void;
  isInitialSetupMode?: boolean;
  onCancelSetup?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  config,
  onUnlock,
  onSaveConfig,
  isInitialSetupMode = false,
  onCancelSetup,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [hintInput, setHintInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(isInitialSetupMode || (!config.passwordHash && config.isEnabled));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [isSettingUp]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setTimeout(() => {
        setLockoutSeconds((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutSeconds]);

  const triggerShake = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutSeconds > 0) return;
    if (!inputCode.trim()) {
      triggerShake('Please enter your passcode or password');
      return;
    }

    setIsSubmitting(true);
    try {
      const isValid = await verifyPassword(inputCode, config.salt, config.passwordHash);
      if (isValid) {
        setErrorMsg(null);
        setFailedAttempts(0);
        onUnlock();
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        setInputCode('');
        if (nextFailed >= 5) {
          setLockoutSeconds(30);
          triggerShake('Too many failed attempts. Locked for 30 seconds.');
        } else {
          triggerShake(`Incorrect passcode. ${5 - nextFailed} attempt(s) remaining.`);
        }
      }
    } catch (err) {
      triggerShake('An error occurred verifying password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.length < 4) {
      triggerShake('Passcode/Password must be at least 4 characters');
      return;
    }
    if (inputCode !== confirmCode) {
      triggerShake('Confirmation passcode does not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(inputCode, salt);
      const newConfig: SecurityConfig = {
        ...config,
        isEnabled: true,
        passwordHash,
        salt,
        hint: hintInput.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      if (onSaveConfig) {
        onSaveConfig(newConfig);
      }
      onUnlock();
    } catch (err) {
      triggerShake('Failed to create password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePadPress = (num: string) => {
    if (lockoutSeconds > 0) return;
    setErrorMsg(null);
    setInputCode((prev) => prev + num);
  };

  const handlePadBackspace = () => {
    if (lockoutSeconds > 0) return;
    setErrorMsg(null);
    setInputCode((prev) => prev.slice(0, -1));
  };

  const handlePadClear = () => {
    if (lockoutSeconds > 0) return;
    setErrorMsg(null);
    setInputCode('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-md p-4 select-none overflow-y-auto">
      {/* Decorative background grid subtle overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      <div 
        className={`relative w-full max-w-md bg-zinc-900 border-2 border-amber-500/40 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] text-zinc-100 p-6 sm:p-8 transition-transform duration-150 ${
          isShaking ? 'animate-bounce text-red-400' : ''
        }`}
      >
        {/* Top App Branding */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-amber-400 text-black flex items-center justify-center font-serif font-bold text-2xl shadow-md border border-amber-300">
            Δ
          </div>
          <div className="text-left">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block font-bold">
              Delta Till System
            </span>
            <h1 className="font-serif italic font-bold text-lg text-white leading-tight">
              {isSettingUp ? 'Set Master Passcode' : 'App Locked & Protected'}
            </h1>
          </div>
        </div>

        {!isSettingUp ? (
          /* ================= UNLOCK SCREEN MODE ================= */
          <form onSubmit={handleUnlockSubmit} className="space-y-5">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1">
                <Lock className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-zinc-300">
                Enter your authorized passcode or password to continue
              </p>
            </div>

            {/* Password input field */}
            <div className="space-y-2">
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value);
                    setErrorMsg(null);
                  }}
                  disabled={lockoutSeconds > 0 || isSubmitting}
                  placeholder="Enter PIN or Password"
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-400 rounded-lg px-4 py-3 text-center text-xl sm:text-2xl font-mono tracking-widest text-amber-300 placeholder:text-zinc-600 focus:outline-none transition-colors disabled:opacity-50"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="flex items-center gap-2 p-2.5 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Lockout Warning */}
              {lockoutSeconds > 0 && (
                <p className="text-center text-xs font-mono font-bold text-amber-400 animate-pulse">
                  System locked. Retry in {lockoutSeconds}s
                </p>
              )}
            </div>

            {/* Quick Numeric Keypad (for touch POS & fast till entry) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePadPress(num)}
                  disabled={lockoutSeconds > 0 || isSubmitting}
                  className="h-12 bg-zinc-800/90 hover:bg-zinc-700 active:bg-amber-400 active:text-black border border-zinc-700 rounded-lg text-lg font-mono font-bold text-zinc-200 transition-all flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-40"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePadClear}
                disabled={lockoutSeconds > 0 || isSubmitting}
                className="h-12 bg-zinc-800/60 hover:bg-red-950/60 border border-zinc-700 text-zinc-400 hover:text-red-300 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePadPress('0')}
                disabled={lockoutSeconds > 0 || isSubmitting}
                className="h-12 bg-zinc-800/90 hover:bg-zinc-700 active:bg-amber-400 active:text-black border border-zinc-700 rounded-lg text-lg font-mono font-bold text-zinc-200 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePadBackspace}
                disabled={lockoutSeconds > 0 || isSubmitting}
                className="h-12 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-amber-300 border border-zinc-700 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Unlock Action Button */}
            <button
              type="submit"
              disabled={lockoutSeconds > 0 || isSubmitting || !inputCode}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:pointer-events-none text-black font-bold uppercase tracking-wider text-sm rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>{isSubmitting ? 'Verifying...' : 'Unlock Application'}</span>
            </button>

            {/* Password Hint & Status info */}
            <div className="pt-2 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-800">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Encrypted with SHA-256</span>
              </div>
              {config.hint && (
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showHint ? 'Hide Hint' : 'Password Hint'}</span>
                </button>
              )}
            </div>

            {showHint && config.hint && (
              <div className="p-3 bg-zinc-950 border border-amber-500/30 rounded-lg text-xs text-amber-200">
                <span className="font-bold text-amber-400">Hint:</span> {config.hint}
              </div>
            )}
          </form>
        ) : (
          /* ================= INITIAL SETUP MODE ================= */
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1">
                <KeyRound className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-zinc-300">
                Create a Master Passcode or Password to protect your cash records.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-zinc-400 mb-1">
                  New PIN or Password (min 4 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="e.g. 1234 or manager_pass"
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-base font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-zinc-400 mb-1">
                  Confirm PIN or Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="Re-enter to confirm"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-base font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-zinc-400 mb-1">
                  Password Hint (Optional)
                </label>
                <input
                  type="text"
                  value={hintInput}
                  onChange={(e) => setHintInput(e.target.value)}
                  placeholder="e.g. Safe code last 4 digits"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-2 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              {onCancelSetup && (
                <button
                  type="button"
                  onClick={onCancelSetup}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase tracking-wider text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !inputCode || !confirmCode}
                className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-bold uppercase tracking-wider text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save & Lock</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
