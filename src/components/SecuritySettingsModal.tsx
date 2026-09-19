import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Unlock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Clock, 
  FileLock2, 
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { SecurityConfig, verifyPassword, hashPassword, generateSalt } from '../utils/security';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SecurityConfig;
  onSaveConfig: (newConfig: SecurityConfig) => void;
  onLockNow: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onLockNow,
}) => {
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState(config.hint || '');
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(config.autoLockMinutes ?? 15);
  const [requireForSheetUnlock, setRequireForSheetUnlock] = useState(config.requireForSheetUnlock ?? false);
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleToggleEnable = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsEnabled(e.target.checked);
    setStatusMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setIsSubmitting(true);

    try {
      // If password protection was already enabled, user must confirm current password to make changes
      if (config.isEnabled && config.passwordHash) {
        const isCurrentValid = await verifyPassword(currentPassword, config.salt, config.passwordHash);
        if (!isCurrentValid) {
          setStatusMsg({
            type: 'error',
            text: 'Current password is required to save security changes.',
          });
          setIsSubmitting(false);
          return;
        }
      }

      // If enabling or changing password
      let updatedHash = config.passwordHash;
      let updatedSalt = config.salt;

      if (isEnabled) {
        if (newPassword) {
          if (newPassword.length < 4) {
            setStatusMsg({
              type: 'error',
              text: 'New password must be at least 4 characters.',
            });
            setIsSubmitting(false);
            return;
          }
          if (newPassword !== confirmPassword) {
            setStatusMsg({
              type: 'error',
              text: 'New password confirmation does not match.',
            });
            setIsSubmitting(false);
            return;
          }
          updatedSalt = generateSalt();
          updatedHash = await hashPassword(newPassword, updatedSalt);
        } else if (!config.passwordHash) {
          setStatusMsg({
            type: 'error',
            text: 'Please choose a password to enable password protection.',
          });
          setIsSubmitting(false);
          return;
        }
      }

      const updatedConfig: SecurityConfig = {
        isEnabled,
        passwordHash: isEnabled ? updatedHash : '',
        salt: isEnabled ? updatedSalt : '',
        hint: isEnabled ? hint.trim() : '',
        autoLockMinutes,
        requireForSheetUnlock,
        updatedAt: new Date().toISOString(),
      };

      onSaveConfig(updatedConfig);
      setStatusMsg({
        type: 'success',
        text: isEnabled ? 'Security settings saved successfully!' : 'Password protection disabled.',
      });

      // Clear inputs
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Failed to save security settings.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl text-zinc-100 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Security & Passcode Protection
              </h2>
              <p className="text-xs text-zinc-400">
                Manage master passcode, lock screen, and auto-lock timeouts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 text-xs ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                  : 'bg-red-950/80 border border-red-500/50 text-red-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Master Enable/Disable Switch */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">App Password Protection</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                    isEnabled
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {isEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Require PIN or password before accessing daily till takings and audits.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={handleToggleEnable}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
            </label>
          </div>

          {/* Password Fields (if enabled or existing) */}
          {isEnabled && (
            <div className="space-y-4 border-t border-zinc-800 pt-4">
              {config.isEnabled && config.passwordHash && (
                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-amber-400 mb-1">
                    Current Password / PIN <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password to authorize changes"
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg px-3.5 py-2.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-zinc-300 mb-1">
                    {config.passwordHash ? 'New Password / PIN' : 'Create Passcode'}
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={config.passwordHash ? 'Leave blank to keep' : 'Min 4 characters'}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-zinc-300 mb-1">
                    Confirm New Passcode
                  </label>
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter to confirm"
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-zinc-300 mb-1">
                  Password Hint
                </label>
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="e.g. Safe code last 4 digits"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              {/* Auto-lock timer option */}
              <div className="space-y-1 pt-2">
                <label className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Lock on Inactivity</span>
                </label>
                <select
                  value={autoLockMinutes}
                  onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                >
                  <option value={0}>Immediately when app is closed / minimized</option>
                  <option value={2}>After 2 minutes of inactivity</option>
                  <option value={5}>After 5 minutes of inactivity</option>
                  <option value={15}>After 15 minutes of inactivity (Recommended)</option>
                  <option value={30}>After 30 minutes of inactivity</option>
                  <option value={-1}>Never while browser tab is active</option>
                </select>
              </div>

              {/* Require passcode to unlock locked/finalized sheets */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 p-3 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireForSheetUnlock}
                    onChange={(e) => setRequireForSheetUnlock(e.target.checked)}
                    className="mt-0.5 rounded text-amber-400 focus:ring-amber-400"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-zinc-200 block">
                      Protect Finalized Shift Unlock
                    </span>
                    <span className="text-zinc-400">
                      Require master password when attempting to unlock previously finalized & locked daily sheets.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Quick Lock Now Action */}
          {config.isEnabled && config.passwordHash && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
              <div className="text-xs">
                <span className="font-bold text-amber-400 block">Lock Application Now</span>
                <span className="text-zinc-400">Instantly lock the display before stepping away.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLockNow();
                }}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase tracking-wider text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Now</span>
              </button>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
