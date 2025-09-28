import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface HtmlContentProps {
  content: string;
  className?: string;
}

export default function HtmlContent({ content, className }: HtmlContentProps) {
  // Secure HTML sanitization using DOMPurify
  const sanitizedContent = useMemo(() => {
    return DOMPurify.sanitize(content, {
      // Allow only safe HTML elements and attributes
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'a'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      // Prevent XSS through links
      ALLOW_DATA_ATTR: false,
    });
  }, [content]);

  return (
    <div 
      className={cn("prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1", className)}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}