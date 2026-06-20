// src/utils/sanitize.js
// Sanitize user-authored flashcard HTML before rendering via dangerouslySetInnerHTML.
// DOMPurify strips <script>, event handlers (on*), javascript:/data: URIs, etc.,
// while keeping the rich formatting + image-occlusion markup the editor produces.
import DOMPurify from 'dompurify';

export function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') return '';
  if (typeof window === 'undefined') return ''; // never rendered on the server (ssr:false routes)
  return DOMPurify.sanitize(html, {
    ALLOW_DATA_ATTR: true,        // image-occlusion cards use data-* attributes
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
}
