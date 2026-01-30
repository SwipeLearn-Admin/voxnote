'use client';

import { useMemo } from 'react';
import clsx from 'clsx';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Simple markdown renderer for LLM responses
 * Supports: headers, lists, bold, italic, code
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div
      className={clsx('markdown-content', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function parseMarkdown(text: string): string {
  let html = text;

  // Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-text-primary mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold text-text-primary mt-3 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-text-primary mt-3 mb-2">$1</h1>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-surface-glass rounded text-xs font-mono text-primary">$1</code>');

  // Checkboxes
  html = html.replace(
    /^- \[x\] (.+)$/gm,
    '<div class="flex items-start gap-2 my-1"><span class="w-4 h-4 mt-0.5 rounded border border-success bg-success/20 flex items-center justify-center text-success text-xs">✓</span><span class="text-text-secondary">$1</span></div>'
  );
  html = html.replace(
    /^- \[ \] (.+)$/gm,
    '<div class="flex items-start gap-2 my-1"><span class="w-4 h-4 mt-0.5 rounded border border-border"></span><span class="text-text-secondary">$1</span></div>'
  );

  // Bullet lists
  html = html.replace(
    /^- (.+)$/gm,
    '<div class="flex items-start gap-2 my-1"><span class="w-1.5 h-1.5 mt-2 rounded-full bg-primary/60"></span><span>$1</span></div>'
  );

  // Numbered lists
  html = html.replace(
    /^(\d+)\. (.+)$/gm,
    '<div class="flex items-start gap-2 my-1"><span class="text-primary/80 text-xs font-medium min-w-[1.25rem]">$1.</span><span>$2</span></div>'
  );

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p class="my-2">');

  // Single newlines to <br>
  html = html.replace(/\n/g, '<br />');

  // Wrap in paragraph
  html = `<p class="my-1">${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p class="my-\d+">\s*<\/p>/g, '');

  return html;
}
