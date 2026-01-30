'use client';

import { motion } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import type { ChatMessage } from '@/lib/store';
import { SuggestedActions } from './SuggestedActions';
import { ArtifactCard } from './ArtifactCard';

interface MessageBubbleProps {
  message: ChatMessage;
  onActionSelect?: (actionId: string) => void;
}

export function MessageBubble({ message, onActionSelect }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isArtifact = message.kind === 'artifact';
  const isStatus = message.kind === 'status';
  const isQuestion = message.kind === 'question';
  const isError = message.kind === 'error';

  // System messages (small, muted pill)
  if (isSystem && !isError) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted px-3 py-1 glass rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  // Error messages
  if (isError) {
    return (
      <div className="flex justify-start my-2">
        <div className="max-w-[85%]">
          <div className="flex items-start gap-2 px-4 py-3 bg-danger/10 border border-danger/20 rounded-2xl backdrop-blur-sm">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-danger">{message.content}</p>
              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="mt-3">
                  <SuggestedActions
                    actions={message.suggestedActions}
                    onSelect={onActionSelect}
                    variant="error"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Status messages (loading state with spinner)
  if (isStatus && message.isStreaming) {
    return (
      <div className="flex justify-start my-2">
        <div className="flex items-center gap-2 px-4 py-2 glass rounded-2xl text-sm text-text-secondary">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-4 h-4" />
          </motion.div>
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  // Completed status (non-streaming, non-error)
  if (isStatus && !message.isStreaming) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted px-3 py-1 glass rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  // Artifact messages - use ArtifactCard
  if (isArtifact) {
    return (
      <div className="flex justify-start my-2">
        <ArtifactCard
          mode={message.mode}
          markdown={message.content}
          data={message.data}
          messageId={message.id}
          timestamp={new Date(message.createdAt)}
          defaultExpanded={true}
        />
      </div>
    );
  }

  // Regular messages (user/assistant text and questions)
  return (
    <div
      className={clsx('flex my-2', {
        'justify-end': isUser,
        'justify-start': !isUser,
      })}
    >
      <div
        className={clsx('max-w-[85%] rounded-2xl transition-colors', {
          // User messages - gradient accent
          'bg-gradient-to-br from-primary to-primary/80 text-white px-4 py-2.5 shadow-lg shadow-primary/20':
            isUser,
          // Assistant question/text
          'glass px-4 py-2.5': !isUser,
        })}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
