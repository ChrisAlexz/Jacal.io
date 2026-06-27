'use client';
// src/components/ImageOcclusionEditor.jsx
// Anki-style image occlusion editor: upload/paste an image, draw resizable/movable
// mask boxes over it, and generate one card per box. Two modes (like Anki):
//   - "Hide All, Guess One": every box is masked on the front; the target box is
//      highlighted; the back reveals only the target.
//   - "Hide One, Guess One": only the target box is masked.
// Masks are stored as percentages of the image, so cards render responsively.
import { logger } from '../utils/logger';
import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import '../styles/ImageOcclusionEditor.css';

const MIN_PCT = 1.5; // minimum mask size (% of image) to keep
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = (n) => Math.round(n * 100) / 100;
const escapeAttr = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export default function ImageOcclusionEditor({ onSave, disabled = false }) {
  const { user } = useContext(UserAuthContext);

  const [previewUrl, setPreviewUrl] = useState(''); // local object URL (instant display)
  const [imageUrl, setImageUrl] = useState(''); // uploaded public URL (used in cards)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [masks, setMasks] = useState([]); // { id, x, y, w, h } in %
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('hideAll'); // 'hideAll' | 'hideOne'
  const [error, setError] = useState('');

  const overlayRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastFileRef = useRef(null); // for "Retry upload"
  const nextId = useRef(1);
  const drag = useRef(null); // active interaction: { type, id, handle, startX, startY, orig }

  const displayUrl = previewUrl || imageUrl;
  const ready = Boolean(imageUrl) && !isUploading;

  // ── Upload / paste ──────────────────────────────────────────────────
  const uploadFile = useCallback(
    async (file) => {
      if (!user) {
        setError('You must be signed in to upload images.');
        setUploadFailed(true);
        return;
      }
      setError('');
      setUploadFailed(false);
      setIsUploading(true);
      try {
        const ext = (file.name?.split('.').pop() || 'png').toLowerCase();
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('flashcard-images')
          .upload(fileName, file);
        if (upErr) throw upErr;
        const {
          data: { publicUrl },
        } = supabase.storage.from('flashcard-images').getPublicUrl(fileName);
        setImageUrl(publicUrl);
      } catch (e) {
        logger.error('Image occlusion upload failed:', e);
        setError(`Image upload failed: ${e?.message || e?.error || 'unknown error'}`);
        setUploadFailed(true);
      } finally {
        setIsUploading(false);
      }
    },
    [user]
  );

  const processFile = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      lastFileRef.current = file;
      setPreviewUrl(URL.createObjectURL(file));
      setImageUrl('');
      setMasks([]);
      setSelectedId(null);
      nextId.current = 1;
      await uploadFile(file);
    },
    [uploadFile]
  );

  const retryUpload = () => {
    if (lastFileRef.current) uploadFile(lastFileRef.current);
  };

  const onFileInput = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  };

  useEffect(() => {
    const onPaste = (e) => {
      if (disabled) return;
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
        return;
      }
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            processFile(f);
            break;
          }
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [disabled, processFile]);

  // ── Geometry ────────────────────────────────────────────────────────
  const pctFromEvent = (e) => {
    const r = overlayRef.current.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
      y: clamp(((e.clientY - r.top) / r.height) * 100, 0, 100),
    };
  };

  const updateMask = (id, patch) =>
    setMasks((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const deleteMask = (id) => {
    setMasks((prev) => prev.filter((m) => m.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  };

  // ── Pointer interactions ────────────────────────────────────────────
  const beginDrawing = (e) => {
    if (disabled || !ready || e.button !== 0) return;
    e.preventDefault();
    overlayRef.current.setPointerCapture?.(e.pointerId);
    const p = pctFromEvent(e);
    const id = nextId.current++;
    drag.current = { type: 'draw', id, startX: p.x, startY: p.y };
    setMasks((prev) => [...prev, { id, x: p.x, y: p.y, w: 0, h: 0 }]);
    setSelectedId(id);
  };

  const beginMove = (e, id) => {
    if (disabled || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    overlayRef.current.setPointerCapture?.(e.pointerId);
    const m = masks.find((x) => x.id === id);
    const p = pctFromEvent(e);
    setSelectedId(id);
    drag.current = { type: 'move', id, startX: p.x, startY: p.y, orig: { ...m } };
  };

  const beginResize = (e, id, handle) => {
    if (disabled || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    overlayRef.current.setPointerCapture?.(e.pointerId);
    const m = masks.find((x) => x.id === id);
    const p = pctFromEvent(e);
    setSelectedId(id);
    drag.current = { type: 'resize', id, handle, startX: p.x, startY: p.y, orig: { ...m } };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = pctFromEvent(e);

    if (d.type === 'draw') {
      updateMask(d.id, {
        x: Math.min(d.startX, p.x),
        y: Math.min(d.startY, p.y),
        w: Math.abs(p.x - d.startX),
        h: Math.abs(p.y - d.startY),
      });
    } else if (d.type === 'move') {
      const { orig } = d;
      updateMask(d.id, {
        x: clamp(orig.x + (p.x - d.startX), 0, 100 - orig.w),
        y: clamp(orig.y + (p.y - d.startY), 0, 100 - orig.h),
      });
    } else if (d.type === 'resize') {
      const o = d.orig;
      let { x, y, w, h } = o;
      const dx = p.x - d.startX;
      const dy = p.y - d.startY;
      if (d.handle.includes('e')) w = o.w + dx;
      if (d.handle.includes('s')) h = o.h + dy;
      if (d.handle.includes('w')) {
        x = o.x + dx;
        w = o.w - dx;
      }
      if (d.handle.includes('n')) {
        y = o.y + dy;
        h = o.h - dy;
      }
      if (w < 0) {
        x += w;
        w = -w;
      }
      if (h < 0) {
        y += h;
        h = -h;
      }
      x = clamp(x, 0, 100);
      y = clamp(y, 0, 100);
      updateMask(d.id, { x, y, w: clamp(w, 0, 100 - x), h: clamp(h, 0, 100 - y) });
    }
  };

  const endPointer = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.type === 'draw') {
      // discard accidental tiny boxes (treated as a click → deselect)
      let removed = false;
      setMasks((prev) =>
        prev.filter((m) => {
          if (m.id === d.id && (m.w < MIN_PCT || m.h < MIN_PCT)) {
            removed = true;
            return false;
          }
          return true;
        })
      );
      if (removed) setSelectedId((s) => (s === d.id ? null : s));
    }
  };

  // Delete selected mask with keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (disabled || selectedId == null) return;
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteMask(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, disabled]);

  // ── Card generation (stored as front/back HTML) ─────────────────────
  const buildSideHTML = (targetId, side) => {
    const rects = masks
      .map((m) => {
        const isTarget = m.id === targetId;
        if (mode === 'hideOne' && !isTarget) return '';
        const cls =
          side === 'front'
            ? isTarget
              ? 'occlusion-question-active'
              : 'occlusion-blocked'
            : isTarget
            ? 'occlusion-answer-revealed'
            : 'occlusion-blocked';
        return `<div class="${cls}" style="left:${round(m.x)}%;top:${round(m.y)}%;width:${round(
          m.w
        )}%;height:${round(m.h)}%"></div>`;
      })
      .join('');
    return `<div class="image-occlusion-card"><img src="${escapeAttr(
      imageUrl
    )}" alt="" class="occlusion-image" /><div class="occlusion-overlay">${rects}</div></div>`;
  };

  const handleSave = () => {
    if (!imageUrl) {
      setError(isUploading ? 'Please wait for the image to finish uploading.' : 'Upload an image first.');
      return;
    }
    if (masks.length === 0) {
      setError('Draw at least one box to hide.');
      return;
    }
    setError('');
    const cards = masks.map((m, i) => ({
      title: `Image Occlusion ${i + 1}`,
      front: buildSideHTML(m.id, 'front'),
      back: buildSideHTML(m.id, 'back'),
    }));
    onSave(cards);

    // reset for the next image-occlusion note
    setMasks([]);
    setSelectedId(null);
    nextId.current = 1;
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="io-editor">
      <div className="io-head">
        <h3>Image Occlusion</h3>
        <p>Upload or paste an image, then drag to draw boxes over what you want to hide. Each box becomes its own card.</p>
      </div>

      {!displayUrl ? (
        <button
          type="button"
          className="io-dropzone"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="io-dropzone-icon">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20" />
          </svg>
          <span className="io-dropzone-title">Choose an image</span>
          <span className="io-dropzone-sub">or paste from clipboard (Ctrl / Cmd + V)</span>
        </button>
      ) : (
        <>
          <div className="io-toolbar">
            <div className="io-modes" role="group" aria-label="Occlusion mode">
              <button
                type="button"
                className={`io-mode ${mode === 'hideAll' ? 'active' : ''}`}
                onClick={() => setMode('hideAll')}
                disabled={disabled}
              >
                Hide all, guess one
              </button>
              <button
                type="button"
                className={`io-mode ${mode === 'hideOne' ? 'active' : ''}`}
                onClick={() => setMode('hideOne')}
                disabled={disabled}
              >
                Hide one, guess one
              </button>
            </div>

            <div className="io-toolbar-actions">
              <button
                type="button"
                className="io-tool"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                title="Replace image"
              >
                Replace image
              </button>
              <button
                type="button"
                className="io-tool"
                onClick={() => setMasks((prev) => prev.slice(0, -1))}
                disabled={disabled || masks.length === 0}
                title="Undo last box"
              >
                Undo
              </button>
              <button
                type="button"
                className="io-tool danger"
                onClick={() => deleteMask(selectedId)}
                disabled={disabled || selectedId == null}
                title="Delete selected box"
              >
                Delete
              </button>
              <button
                type="button"
                className="io-tool danger"
                onClick={() => {
                  setMasks([]);
                  setSelectedId(null);
                }}
                disabled={disabled || masks.length === 0}
                title="Clear all boxes"
              >
                Clear
              </button>
            </div>
          </div>

          <div className={`io-stage ${uploadFailed ? 'failed' : ''}`}>
            {isUploading && <div className="io-uploading">Uploading image…</div>}
            <img src={displayUrl} alt="" className="io-img" draggable={false} />
            <div
              ref={overlayRef}
              className={`io-overlay ${disabled || !ready ? 'inert' : ''}`}
              onPointerDown={beginDrawing}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
            >
              {masks.map((m) => {
                const selected = selectedId === m.id;
                return (
                  <div
                    key={m.id}
                    className={`io-mask ${selected ? 'selected' : ''}`}
                    style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
                    onPointerDown={(e) => beginMove(e, m.id)}
                  >
                    {selected &&
                      !disabled &&
                      HANDLES.map((h) => (
                        <span
                          key={h}
                          className={`io-handle io-${h}`}
                          onPointerDown={(e) => beginResize(e, m.id, h)}
                        />
                      ))}
                  </div>
                );
              })}
            </div>

            {uploadFailed && (
              <div className="io-failed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="io-failed-icon">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="io-failed-text">Image didn’t upload</span>
                <button type="button" className="io-retry" onClick={retryUpload}>
                  Retry upload
                </button>
              </div>
            )}
          </div>

          <div className="io-footer">
            <span className="io-count">
              {masks.length} {masks.length === 1 ? 'box' : 'boxes'}
              <span className="io-hint">Click a box to select · drag to move · Delete to remove</span>
            </span>
            <button
              type="button"
              className="io-save"
              onClick={handleSave}
              disabled={disabled || !ready || masks.length === 0}
            >
              {isUploading
                ? 'Uploading…'
                : `Create ${masks.length || ''} ${masks.length === 1 ? 'card' : 'cards'}`.trim()}
            </button>
          </div>
        </>
      )}

      {error && <div className="io-error">{error}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileInput}
        disabled={disabled || isUploading}
        style={{ display: 'none' }}
      />
    </div>
  );
}
