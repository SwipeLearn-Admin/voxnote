'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Save, Info, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { ModeId, Settings } from '../../electron/shared/types';
import clsx from 'clsx';

const MODES = [
  { id: 'meeting', label: 'Meeting-Notiz' },
  { id: 'tasks', label: 'Aufgaben' },
  { id: 'email', label: 'E-Mail' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'devnote', label: 'Dev Note' },
  { id: 'clean', label: 'Bereinigen' },
] as const;

export function SettingsModal() {
  const { settings, setSettingsOpen, saveSettings } = useAppStore();

  const [formData, setFormData] = useState<Partial<Settings>>({
    openaiApiKey: '',
    hotkey: 'CommandOrControl+Shift+Space',
    defaultMode: 'meeting',
    saveHistory: true,
    language: 'auto',
    openaiTranscribeModel: 'whisper-1',
    openaiChatModel: 'gpt-4o-mini',
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        openaiApiKey: settings.openaiApiKey || '',
        hotkey: settings.hotkey,
        defaultMode: settings.defaultMode,
        saveHistory: settings.saveHistory,
        language: settings.language,
        openaiTranscribeModel: settings.openaiTranscribeModel,
        openaiChatModel: settings.openaiChatModel,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (key: keyof Settings, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setSettingsOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-secondary/95 backdrop-blur-xl border border-border rounded-2xl w-[420px] max-h-[90%] overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="text-base font-semibold text-text-primary">Einstellungen</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSettingsOpen(false)}
              className="p-1.5 glass glass-hover rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-muted" />
            </motion.button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* API Key */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.openaiApiKey || ''}
                  onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                  placeholder="sk-..."
                  className="w-full glass rounded-xl px-3.5 py-2.5 pr-10 text-sm text-text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-active rounded-lg transition-colors"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4 text-muted" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted flex items-center gap-1">
                <Info className="w-3 h-3" />
                Wird lokal gespeichert
              </p>
            </div>

            {/* Hotkey */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">
                Global Hotkey
              </label>
              <input
                type="text"
                value={formData.hotkey || ''}
                onChange={(e) => handleChange('hotkey', e.target.value)}
                placeholder="CommandOrControl+Shift+Space"
                className="w-full glass rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Default Mode */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">
                Standard-Modus
              </label>
              <select
                value={formData.defaultMode}
                onChange={(e) => handleChange('defaultMode', e.target.value as ModeId)}
                className="w-full glass rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat"
              >
                {MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">
                Sprache
              </label>
              <select
                value={formData.language}
                onChange={(e) =>
                  handleChange('language', e.target.value as 'auto' | 'de' | 'en')
                }
                className="w-full glass rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat"
              >
                <option value="auto">Automatisch</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </div>

            {/* Save History Toggle */}
            <div className="flex items-center justify-between py-2 px-3.5 glass rounded-xl">
              <div>
                <label className="block text-sm font-medium text-text-primary">
                  History speichern
                </label>
                <p className="text-xs text-muted">
                  Transkripte und Ergebnisse lokal speichern
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleChange('saveHistory', !formData.saveHistory)}
                className={clsx(
                  'relative w-11 h-6 rounded-full transition-colors',
                  formData.saveHistory ? 'bg-primary' : 'bg-surface-active'
                )}
              >
                <motion.span
                  animate={{ x: formData.saveHistory ? 20 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-3">
              <h3 className="text-xs font-medium text-muted mb-3 uppercase tracking-wider">
                Modelle
              </h3>
            </div>

            {/* Transcribe Model */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">
                Transkription
              </label>
              <input
                type="text"
                value={formData.openaiTranscribeModel || ''}
                onChange={(e) => handleChange('openaiTranscribeModel', e.target.value)}
                placeholder="whisper-1"
                className="w-full glass rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Chat Model */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">
                Chat / Enrichment
              </label>
              <input
                type="text"
                value={formData.openaiChatModel || ''}
                onChange={(e) => handleChange('openaiChatModel', e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full glass rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3.5 border-t border-border flex items-center justify-end gap-2 shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSettingsOpen(false)}
              className="px-4 py-2 glass glass-hover text-text-primary text-sm rounded-xl transition-colors"
            >
              Schließen
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className={clsx(
                'px-4 py-2 text-sm rounded-xl transition-all flex items-center gap-1.5',
                saved
                  ? 'bg-success text-white'
                  : 'bg-primary hover:bg-primary-hover hover:shadow-glow-primary text-white',
                'disabled:opacity-50'
              )}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Gespeichert
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
