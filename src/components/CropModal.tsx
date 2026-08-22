"use client";

import { useEffect, useRef, useState } from "react";

// Frame a photo into the 3:4 card at upload time: drag to reposition,
// pinch or slider to zoom. All on-device — the original file never uploads,
// only the cropped card (same privacy property as the automatic crop).

const OUT_W = 480;
const OUT_H = 640;
const K = 0.55; // on-screen scale of the crop stage

export function CropModal({
  file,
  index,
  total,
  onDone,
  onUseAsIs,
  onRestAsIs,
  onSkip,
}: {
  file: File;
  index: number;
  total: number;
  onDone: (blob: Blob) => void;
  onUseAsIs: () => void;
  onRestAsIs: () => void;
  onSkip: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setDims(null);
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setBusy(false);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const s0 = dims ? Math.max(OUT_W / dims.w, OUT_H / dims.h) : 1;
  const s = s0 * zoom;

  function clamp(o: { x: number; y: number }, sc: number) {
    if (!dims) return o;
    return {
      x: Math.min(0, Math.max(OUT_W - dims.w * sc, o.x)),
      y: Math.min(0, Math.max(OUT_H - dims.h * sc, o.y)),
    };
  }

  useEffect(() => {
    if (dims) {
      const sc = Math.max(OUT_W / dims.w, OUT_H / dims.h);
      setOff({ x: (OUT_W - dims.w * sc) / 2, y: (OUT_H - dims.h * sc) / 2 });
    }
  }, [dims]);

  function zoomTo(z: number) {
    const nz = Math.min(3, Math.max(1, z));
    if (dims) {
      const os = s0 * zoom;
      const ns = s0 * nz;
      // keep the frame's center point steady while zooming
      setOff((o) =>
        clamp({ x: OUT_W / 2 - (OUT_W / 2 - o.x) * (ns / os), y: OUT_H / 2 - (OUT_H / 2 - o.y) * (ns / os) }, ns)
      );
    }
    setZoom(nz);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart.current.dist > 0) zoomTo(pinchStart.current.zoom * (d / pinchStart.current.dist));
    } else if (pointers.current.size === 1) {
      const dx = (e.clientX - prev.x) / K;
      const dy = (e.clientY - prev.y) / K;
      setOff((o) => clamp({ x: o.x + dx, y: o.y + dy }, s));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  async function save() {
    if (!url || !dims || !imgRef.current || busy) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imgRef.current, off.x, off.y, dims.w * s, dims.h * s);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (blob) onDone(blob);
    else setBusy(false);
  }

  return (
    <div className="zoom-backdrop" role="dialog" aria-modal="true" aria-label="Frame this photo">
      <div className="zoom-card fade-in" style={{ width: "min(360px,100%)" }}>
        <p className="eyebrow" style={{ color: "#8a4a2c", marginBottom: 10 }}>
          Photo {index + 1} of {total} · drag to move, pinch or slide to zoom
        </p>
        <div className="crop-stage" style={{ width: OUT_W * K, height: OUT_H * K }}>
          <div
            className="crop-frame"
            style={{ width: OUT_W, height: OUT_H, transform: `scale(${K})` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                ref={imgRef}
                src={url}
                alt="Photo being framed"
                draggable={false}
                onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: dims?.w,
                  height: dims?.h,
                  maxWidth: "none",
                  transformOrigin: "0 0",
                  transform: `translate(${off.x}px, ${off.y}px) scale(${s})`,
                }}
              />
            )}
          </div>
        </div>
        <input
          type="range"
          min={100}
          max={300}
          value={Math.round(zoom * 100)}
          onChange={(e) => zoomTo(Number(e.target.value) / 100)}
          aria-label="Zoom"
          style={{ width: "80%", margin: "14px 0 4px", accentColor: "var(--ember)" }}
        />
        <div className="zoom-actions">
          <button className="btn solid sm" onClick={save} disabled={!dims || busy}>
            {busy ? "Adding…" : "Use this crop"}
          </button>
          <button className="btn ghost sm" onClick={onUseAsIs} disabled={busy}>Use as-is</button>
          {total - index > 1 && (
            <button className="btn ghost sm" onClick={onRestAsIs} disabled={busy}>Add the rest as-is</button>
          )}
          <button className="btn ghost sm" onClick={onSkip} disabled={busy}>Skip photo</button>
        </div>
      </div>
    </div>
  );
}
