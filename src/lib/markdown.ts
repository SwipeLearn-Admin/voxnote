// Markdown utility functions

/**
 * Extract a summary preview from markdown content
 */
export function extractPreview(markdown: string, maxLength: number = 100): string {
  // Remove markdown headers
  let text = markdown.replace(/^#+\s+.+$/gm, '');

  // Remove list markers
  text = text.replace(/^[\s]*[-*+]\s+(\[.\])?\s*/gm, '');

  // Remove emphasis markers
  text = text.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');

  // Remove extra whitespace and newlines
  text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  // Truncate
  if (text.length > maxLength) {
    text = text.substring(0, maxLength).trim() + '...';
  }

  return text || 'No content';
}

/**
 * Format relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  return 'Just now';
}

/**
 * Format absolute time
 */
export function formatAbsoluteTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Format recording duration in MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
