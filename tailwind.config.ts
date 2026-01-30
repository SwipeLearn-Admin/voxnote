import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background colors
        background: 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',

        // Surface colors (glass)
        surface: 'var(--surface-glass)',
        'surface-hover': 'var(--surface-glass-hover)',
        'surface-active': 'var(--surface-glass-active)',

        // Border colors
        border: 'var(--border-subtle)',
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',

        // Primary accent
        primary: 'var(--accent-primary)',
        'primary-hover': 'var(--accent-primary-hover)',
        'primary-glow': 'var(--accent-primary-glow)',

        // Status colors
        danger: 'var(--status-danger)',
        'danger-glow': 'var(--status-danger-glow)',
        success: 'var(--status-success)',
        warning: 'var(--status-warning)',

        // Text colors
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'glow-primary': '0 0 20px var(--accent-primary-glow)',
        'glow-danger': '0 0 20px var(--status-danger-glow)',
      },
      animation: {
        'message-in': 'messageSlideIn 0.25s ease-out forwards',
        'recording-pulse': 'recordingPulse 1.5s ease-in-out infinite',
        'recording-glow': 'recordingGlow 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
