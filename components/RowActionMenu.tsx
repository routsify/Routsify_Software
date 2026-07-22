"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function RowActionMenu({ label, children }: { label: string; children: ReactNode }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const gap = 6;
    const padding = 8;
    const fitsBelow = trigger.bottom + gap + menu.height <= window.innerHeight - padding;
    const top = fitsBelow ? trigger.bottom + gap : Math.max(padding, trigger.top - gap - menu.height);
    const left = Math.min(window.innerWidth - menu.width - padding, Math.max(padding, trigger.right - menu.width));
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    function closeOnViewportChange() { setOpen(false); }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const menu = menuRef.current;
    const close = () => setOpen(false);
    menu.addEventListener("click", close);
    return () => menu.removeEventListener("click", close);
  }, [open]);

  return <>
    <button ref={triggerRef} className="row-action-trigger" type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>•••</button>
    {open ? createPortal(
      <div ref={menuRef} className="row-action-popover" role="menu" style={{ top: position.top, left: position.left }}>{children}</div>,
      document.body,
    ) : null}
  </>;
}
