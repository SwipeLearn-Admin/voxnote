'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Cloud, CloudOff, Loader2, X } from 'lucide-react';
import * as ipc from '@/lib/ipc';
import clsx from 'clsx';

interface AuthUser {
  id: string;
  email: string;
}

export function AuthButton() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setIsLoading(true);
    const result = await ipc.authGetSession();
    if (result && result.isAuthenticated && result.user) {
      setUser(result.user);
      // Auto-sync on login
      handleSync();
    } else {
      setUser(null);
    }
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    const result = await ipc.authSignOut();
    if (result?.success) {
      setUser(null);
      setShowDropdown(false);
    }
  };

  const handleSync = async () => {
    if (isSyncing || !user) return;
    setIsSyncing(true);
    await ipc.syncFull();
    setIsSyncing(false);
  };

  const handleAuthSuccess = (authUser: AuthUser) => {
    setUser(authUser);
    setShowAuthModal(false);
    // Sync after login
    handleSync();
  };

  if (isLoading) {
    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-muted animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Auth Button */}
      <div className="relative">
        <button
          onClick={() => user ? setShowDropdown(!showDropdown) : setShowAuthModal(true)}
          className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
            user
              ? 'bg-primary/15 text-primary hover:bg-primary/25'
              : 'glass glass-hover text-muted hover:text-text-primary'
          )}
          title={user ? user.email : 'Anmelden'}
        >
          {user ? (
            <span className="text-xs font-medium">
              {user.email.charAt(0).toUpperCase()}
            </span>
          ) : (
            <User className="w-4 h-4" />
          )}
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {showDropdown && user && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 w-56 glass-strong rounded-xl shadow-lg overflow-hidden z-50"
            >
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-xs text-muted">Angemeldet als</p>
                <p className="text-sm text-text-primary truncate">{user.email}</p>
              </div>

              {/* Sync button */}
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Cloud className="w-4 h-4" />
                )}
                {isSyncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
              </button>

              {/* Logout button */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Abmelden
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Auth Modal Component
interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = mode === 'login'
        ? await ipc.authSignIn(email, password)
        : await ipc.authSignUp(email, password);

      if (result?.success && result.user) {
        onSuccess({ id: result.user.id, email: result.user.email || email });
      } else {
        setError(result?.error || 'Ein Fehler ist aufgetreten');
      }
    } catch (err) {
      setError('Verbindungsfehler');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-sm glass-strong rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">
            {mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Cloud sync info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-xl">
            <Cloud className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary">
              Synchronisiere deine Notizen in der Cloud
            </span>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs text-muted mb-1.5">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.de"
              required
              className="w-full px-3 py-2.5 glass rounded-xl text-sm text-text-primary placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs text-muted mb-1.5">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-3 py-2.5 glass rounded-xl text-sm text-text-primary placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-danger px-1">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </button>

          {/* Toggle mode */}
          <p className="text-center text-xs text-muted">
            {mode === 'login' ? (
              <>
                Noch kein Konto?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-primary hover:underline"
                >
                  Registrieren
                </button>
              </>
            ) : (
              <>
                Bereits registriert?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-primary hover:underline"
                >
                  Anmelden
                </button>
              </>
            )}
          </p>
        </form>
      </motion.div>
    </motion.div>
  );
}
