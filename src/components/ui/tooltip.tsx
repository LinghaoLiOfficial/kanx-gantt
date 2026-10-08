"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type TooltipAnchorRect = Pick<DOMRect, "top" | "left" | "width" | "height">;

export function TooltipContent({ open, content, anchorRect }: { open: boolean; content: string; anchorRect: TooltipAnchorRect | null }) {
  if (!open || !anchorRect || typeof document === "undefined") return null;
  return createPortal(
    <div className="kanx-tooltip" role="tooltip" style={{ left: anchorRect.left + anchorRect.width / 2, top: anchorRect.top - 8 }}>
      {content}
    </div>,
    document.body,
  );
}

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<TooltipAnchorRect | null>(null);
  const [truncated, setTruncated] = useState(false);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    const target = trigger?.firstElementChild as HTMLElement | null;
    if (!target) return false;
    const next = target.scrollWidth > target.clientWidth + 1;
    setTruncated(next);
    return next;
  }, []);
  const show = useCallback(() => {
    if (!measure()) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) { setAnchorRect(rect); setOpen(true); }
  }, [measure]);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    measure();
    const trigger = triggerRef.current;
    if (!trigger || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [measure]);
  useEffect(() => {
    if (!open) return;
    const update = () => { const rect = triggerRef.current?.getBoundingClientRect(); if (rect) setAnchorRect(rect); };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);

  return <>
    <span ref={triggerRef} className="kanx-tooltip-trigger" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} data-tooltip-truncated={truncated || undefined}>{children}</span>
    <TooltipContent open={open} content={content} anchorRect={anchorRect} />
  </>;
}
