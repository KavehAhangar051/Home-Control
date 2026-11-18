import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function useGroupHeaderLayout() {
  const [isCompact, setIsCompact] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isCompactRef = useRef(isCompact);
  isCompactRef.current = isCompact;

  const titleContainerRef = useRef<HTMLDivElement>(null);
  const titleTextRef = useRef<HTMLHeadingElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = titleContainerRef.current;
    const text = titleTextRef.current;

    if (!container || !text) return;

    const checkSpace = () => {
      const textWidth = text.scrollWidth;
      const textClientWidth = text.clientWidth;

      if (!isCompactRef.current) {
        if (textWidth > textClientWidth) {
          setIsCompact(true);
        }
      } else {
        const layoutSelectorWidth = 100;

        if (textClientWidth - layoutSelectorWidth >= textWidth) {
          setIsCompact(false);
          setIsSettingsOpen(false);
        }
      }
    };

    const observer = new ResizeObserver(checkSpace);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsSettingsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsOpen]);

  return {
    isCompact,
    isSettingsOpen,
    setIsSettingsOpen,
    titleContainerRef,
    titleTextRef,
    buttonRef,
    menuRef,
  };
}
