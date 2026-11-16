import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export interface SegmentMenuPosition {
  top: number;
  left: number;
  placement: "top" | "bottom";
}

export function useCardHeaderLayout(segmentId: string) {
  const isSettingsOpen = useIoTStore((s) => s.openSegmentMenuId === segmentId);
  const setOpenSegmentMenuId = useIoTStore((s) => s.setOpenSegmentMenuId);
  const [showAutoOffMenuState, setShowAutoOffMenuState] = useState(false);
  const [menuPositionState, setMenuPositionState] = useState<SegmentMenuPosition | null>(null);

  const showAutoOffMenu = isSettingsOpen && showAutoOffMenuState;
  const menuPosition = isSettingsOpen ? menuPositionState : null;

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const autoOffButtonRef = useRef<HTMLButtonElement>(null);
  const autoOffMenuRef = useRef<HTMLDivElement>(null);

  const setIsSettingsOpen = useCallback(
    (open: boolean) => {
      setShowAutoOffMenuState(false);
      setMenuPositionState(null);
      setOpenSegmentMenuId(open ? segmentId : null);
    },
    [segmentId, setOpenSegmentMenuId],
  );

  useEffect(() => {
    if (!isSettingsOpen && !showAutoOffMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) return;

      const inMenu = menuRef.current?.contains(target) ?? false;
      const inTrigger = buttonRef.current?.contains(target) ?? false;

      if (!inMenu && !inTrigger) {
        setOpenSegmentMenuId(null);
        setShowAutoOffMenuState(false);

        return;
      }

      if (
        showAutoOffMenu &&
        autoOffMenuRef.current &&
        !autoOffMenuRef.current.contains(target) &&
        autoOffButtonRef.current &&
        !autoOffButtonRef.current.contains(target)
      ) {
        setShowAutoOffMenuState(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (showAutoOffMenu) {
        setShowAutoOffMenuState(false);
      } else {
        setOpenSegmentMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsOpen, showAutoOffMenu, setOpenSegmentMenuId]);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuWidth = menuEl?.offsetWidth || (window.innerWidth < 640 ? 256 : 280);
    const menuHeight = menuEl?.offsetHeight || 220;
    const margin = 8;
    const gap = 6;

    let left = rect.left;

    if (left + menuWidth > window.innerWidth - margin) {
      left = window.innerWidth - margin - menuWidth;
    }

    if (left < margin) {
      left = margin;
    }

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUpward = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;

    const top = openUpward
      ? Math.max(margin, rect.top - menuHeight - gap)
      : Math.min(window.innerHeight - margin - menuHeight, rect.bottom + gap);

    setMenuPositionState((prev) => {
      const nextPlacement = openUpward ? "top" : "bottom";

      if (
        prev &&
        Math.abs(prev.top - top) < 0.5 &&
        Math.abs(prev.left - left) < 0.5 &&
        prev.placement === nextPlacement
      ) {
        return prev;
      }

      return { top, left, placement: nextPlacement };
    });
  }, []);

  useLayoutEffect(() => {
    if (!isSettingsOpen) return;

    updateMenuPosition();

    const rafId = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, { capture: true, passive: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isSettingsOpen, updateMenuPosition]);

  return {
    isSettingsOpen,
    setIsSettingsOpen,
    showAutoOffMenu,
    setShowAutoOffMenu: setShowAutoOffMenuState,
    menuPosition,
    buttonRef,
    menuRef,
    autoOffButtonRef,
    autoOffMenuRef,
  };
}
