"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";

// Frame a photo into the 3:4 card: drag to move, pinch or slide to zoom.
// The frame is sized in real screen pixels so a finger moves the photo 1:1,
// then the same framing is redrawn at card resolution on save. Cropping is
// on-device; only the framed card ever uploads.

const OUT_W = 480;
const OUT_H = 640;

export type CropHandle = {
  /** true once the user has moved or zoomed the photo */
  dirty: boolean;
  /** render the current framing at card resolution */
  blob: () => Promise<Blob | null>;
};

export const CropEditor = forwardRef<CropHandle, { src: string; className?: string; slider?: boolean }>(function CropEditor(
  { src, className, slider = true },
  ref
) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [dirty, setDirty] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // scale at which the photo exactly covers the frame
  const base = nat && frame.w ? Math.max(frame.w / nat.w, frame.h / nat.h) : 1;
  const scale = base * zoom;
  const dispW = nat ? nat.w * scale : 0;
  const dispH = nat ? nat.h * scale : 0;

  const clamp = (o: { x: number; y: number }, w: number, h: number) => ({
    x: Math.min(0, Math.max(frame.w - w, o.x)),
    y: Math.min(0, Math.max(frame.h - h, o.y)),
  });

  // centre the photo whenever it (or the frame) changes size
  useEffect(() => {
    if (!nat || !frame.w) return;
    const s = Math.max(frame.w / nat.w, frame.h / nat.h);
    setZoom(1);
    setOff({ x: (frame.w - nat.w * s) / 2, y: (frame.h - nat.h * s) / 2 });
    setDirty(false);
  }, [nat, frame.w, frame.h]);

  function zoomTo(next: number) {
    const nz = Math.min(3, Math.max(1, next));
    if (nat && frame.w) {
      const oldW = nat.w * base * zoom;
      const newW = nat.w * base * nz;
      const newH = nat.h * base * nz;
      const ratio = newW / oldW;
      setOff((o) =>
        clamp(
          { x: frame.w / 2 - (frame.w / 2 - o.x) * ratio, y: frame.h / 2 - (frame.h / 2 - o.y) * ratio },
          newW,
          newH
        )
      );
    }
    setZoom(nz);
    setDirty(true);
  }

  function down(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function move(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0) zoomTo(pinch.current.zoom * (d / pinch.current.dist));
    } else if (pointers.current.size === 1) {
      setOff((o) => clamp({ x: o.x + (e.clientX - prev.x), y: o.y + (e.clientY - prev.y) }, dispW, dispH));
      setDirty(true);
    }
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }
  // trackpad / mouse wheel zoom for people without a touch screen
  function wheel(e: React.WheelEvent) {
    zoomTo(zoom * (1 - e.deltaY / 400));
  }

  useImperativeHandle(
    ref,
    () => ({
      dirty,
      blob: async () => {
        if (!nat || !imgRef.current || !frame.w) return null;
        const k = OUT_W / frame.w; // screen pixels → card pixels
        const canvas = document.createElement("canvas");
        canvas.width = OUT_W;
        canvas.height = OUT_H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(imgRef.current, off.x * k, off.y * k, dispW * k, dispH * k);
        return new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
      },
    }),
    [dirty, nat, frame.w, off.x, off.y, dispW, dispH]
  );

  return (
    <>
      <div className={`crop-stage ${className ?? ""}`}>
        <div
          ref={frameRef}
          className="crop-frame"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={wheel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            className="crop-img"
            src={src}
            alt="Photo being framed"
            draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{ width: dispW || undefined, height: dispH || undefined, transform: `translate(${off.x}px, ${off.y}px)` }}
          />
        </div>
      </div>
      {slider && (
        <input
          type="range"
          className="crop-zoom"
          min={100}
          max={300}
          value={Math.round(zoom * 100)}
          onChange={(e) => zoomTo(Number(e.target.value) / 100)}
          aria-label="Zoom"
        />
      )}
    </>
  );
});

export function CropModal({
  src,
  title,
  onSave,
  onClose,
}: {
  src: string;
  title: string;
  onSave: (blob: Blob) => void | Promise<void>;
  onClose: () => void;
}) {
  const editor = useRef<CropHandle>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    const blob = await editor.current?.blob();
    if (blob) await onSave(blob);
    setBusy(false);
  }

  return (
    <div className="zoom-backdrop" role="dialog" aria-modal="true" aria-label={`Adjust photo${title ? ` of ${title}` : ""}`} onClick={onClose}>
      <div className="zoom-card fade-in cropper" style={{ width: "min(340px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <p className="crop-hint">Drag to move · pinch or slide to zoom</p>
        <CropEditor ref={editor} src={src} />
        <button className="btn ink" onClick={save} disabled={busy} style={{ width: "100%" }}>
          {busy ? "Saving…" : "Use this crop"}
        </button>
      </div>
    </div>
  );
}
