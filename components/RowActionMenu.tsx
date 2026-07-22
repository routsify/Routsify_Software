"use client";

import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function RowActionMenu({ label, children }: { label: string; children: ReactNode }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 240, ready: false });

  const placeMenu = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const padding = 8;
    const gap = 6;
    const availableBelow = viewportTop + viewportHeight - padding - trigger.bottom - gap;
    const availableAbove = trigger.top - viewportTop - padding - gap;
    const openBelow = availableBelow >= Math.min(menu.height, 180) || availableBelow >= availableAbove;
    const maxHeight = Math.max(96, openBelow ? availableBelow : availableAbove);
    const top = openBelow ? trigger.bottom + gap : Math.max(viewportTop + padding, trigger.top - gap - Math.min(menu.height, maxHeight));
    const left = Math.min(viewportLeft + viewportWidth - menu.width - padding, Math.max(viewportLeft + padding, trigger.right - menu.width));
    setPosition({ top, left, maxHeight, ready: true });
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    setPosition((current) => ({ ...current, ready: false }));
    placeMenu();
    menuRef.current.querySelector<HTMLElement>("a:not([aria-disabled='true']), button:not(:disabled)")?.focus();
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !menuRef.current) return;
      const items = [...menuRef.current.querySelectorAll<HTMLElement>("a:not([aria-disabled='true']), button:not(:disabled)")];
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    window.visualViewport?.addEventListener("resize", placeMenu);
    window.visualViewport?.addEventListener("scroll", placeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      window.visualViewport?.removeEventListener("resize", placeMenu);
      window.visualViewport?.removeEventListener("scroll", placeMenu);
    };
  }, [open, placeMenu]);

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
      <div ref={menuRef} className="row-action-popover" role="menu" style={{ top: position.top, left: position.left, maxHeight: position.maxHeight, visibility: position.ready ? "visible" : "hidden" }}>{children}</div>,
      document.body,
    ) : null}
  </>;
}
