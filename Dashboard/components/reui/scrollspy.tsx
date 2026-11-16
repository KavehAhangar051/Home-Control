// ReUI, Copyright (c) 2025 Keenthemes Inc. — MIT License.
// Adapted from https://reui.io/docs/components/base/scrollspy.
"use client";

import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

type ScrollspyProps = {
  children: ReactNode;
  targetRef?: RefObject<HTMLElement | HTMLDivElement | Document | null | undefined>;
  onUpdate?: (id: string) => void;
  offset?: number;
  smooth?: boolean;
  className?: string;
  dataAttribute?: string;
  history?: boolean;
  throttleTime?: number;
};

export function Scrollspy({
  children,
  targetRef,
  onUpdate,
  className,
  offset = 0,
  smooth = true,
  dataAttribute = "scrollspy",
  history = true,
}: ScrollspyProps) {
  const selfRef = useRef<HTMLDivElement | null>(null);
  const anchorElementsRef = useRef<Element[] | null>(null);
  const prevIdTracker = useRef<string | null>(null);

  // Sets active nav, hash, prevIdTracker, and calls onUpdate
  const setActiveSection = useCallback(
    (sectionId: string | null, force = false) => {
      if (!sectionId) return;
      const anchors = anchorElementsRef.current;

      if (anchors) {
        const attrName = `data-${dataAttribute}-anchor`;

        for (let i = 0; i < anchors.length; i++) {
          const item = anchors[i];
          const id = item.getAttribute(attrName);

          if (id === sectionId) {
            item.setAttribute("data-active", "true");
          } else {
            item.removeAttribute("data-active");
          }
        }
      }

      if (onUpdate) onUpdate(sectionId);

      if (history && (force || prevIdTracker.current !== sectionId)) {
        window.history.replaceState({}, "", `#${sectionId}`);
      }

      prevIdTracker.current = sectionId;
    },
    [dataAttribute, history, onUpdate],
  );

  const handleScroll = useCallback(() => {
    const anchors = anchorElementsRef.current;

    if (!anchors || anchors.length === 0) return;

    let scrollElement: HTMLElement | null =
      targetRef?.current === document
        ? document.documentElement
        : targetRef?.current instanceof HTMLElement
          ? targetRef.current
          : null;

    if (!scrollElement) return;

    // If the scrollElement has a data-slot="scroll-area-viewport" inside, use that
    const viewport = scrollElement.querySelector('[data-slot="scroll-area-viewport"]');

    if (viewport instanceof HTMLElement) {
      scrollElement = viewport;
    }

    const scrollTop =
      scrollElement === document.documentElement
        ? window.scrollY || document.documentElement.scrollTop
        : scrollElement.scrollTop;

    // Find the anchor whose section is closest to but not past the top
    let activeIdx = 0;
    let minDelta = Infinity;
    const anchorAttr = `data-${dataAttribute}-anchor`;
    const offsetAttr = `data-${dataAttribute}-offset`;

    for (let idx = 0; idx < anchors.length; idx++) {
      const anchor = anchors[idx];
      const sectionId = anchor.getAttribute(anchorAttr);

      if (!sectionId) continue;

      const sectionElement = document.getElementById(sectionId);

      if (!sectionElement) continue;

      let customOffset = offset;
      const dataOffset = anchor.getAttribute(offsetAttr);

      if (dataOffset) customOffset = Number.parseInt(dataOffset, 10);

      const delta = Math.abs(sectionElement.offsetTop - customOffset - scrollTop);

      if (sectionElement.offsetTop - customOffset <= scrollTop && delta < minDelta) {
        minDelta = delta;
        activeIdx = idx;
      }
    }

    // If at bottom, force last anchor
    const scrollHeight = scrollElement.scrollHeight;
    const clientHeight = scrollElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 2) {
      activeIdx = anchors.length - 1;
    }

    // Set only one anchor active and sync the URL hash
    const activeAnchor = anchors[activeIdx];
    const sectionId = activeAnchor?.getAttribute(anchorAttr) || null;

    setActiveSection(sectionId);
  }, [targetRef, dataAttribute, offset, setActiveSection]);

  const scrollTo = useCallback(
    (anchorElement: HTMLElement) => (event?: Event) => {
      if (event) event.preventDefault();

      const sectionId =
        anchorElement.getAttribute(`data-${dataAttribute}-anchor`)?.replace("#", "") || null;

      if (!sectionId) return;
      const sectionElement = document.getElementById(sectionId);

      if (!sectionElement) return;

      let scrollToElement: HTMLElement | Window | null =
        targetRef?.current === document
          ? window
          : targetRef?.current instanceof HTMLElement
            ? targetRef.current
            : null;

      if (scrollToElement instanceof HTMLElement) {
        const viewport = scrollToElement.querySelector('[data-slot="scroll-area-viewport"]');

        if (viewport instanceof HTMLElement) {
          scrollToElement = viewport;
        }
      }

      let customOffset = offset;
      const dataOffset = anchorElement.getAttribute(`data-${dataAttribute}-offset`);

      if (dataOffset) {
        customOffset = parseInt(dataOffset, 10);
      }

      const scrollTop = sectionElement.offsetTop - customOffset;

      if (scrollToElement && "scrollTo" in scrollToElement) {
        scrollToElement.scrollTo({
          top: scrollTop,
          left: 0,
          behavior: smooth ? "smooth" : "auto",
        });
      }

      setActiveSection(sectionId, true);
    },
    [dataAttribute, offset, smooth, targetRef, setActiveSection],
  );

  // Scroll to the section if the ID is present in the URL hash
  const scrollToHashSection = useCallback(() => {
    const hash = CSS.escape(window.location.hash.replace("#", ""));

    if (hash) {
      const targetElement = document.querySelector(`[data-${dataAttribute}-anchor="${hash}"]`);

      if (targetElement instanceof HTMLElement) {
        scrollTo(targetElement)();
      }
    }
  }, [dataAttribute, scrollTo]);

  const handleScrollRef = useRef(handleScroll);
  const scrollToHashSectionRef = useRef(scrollToHashSection);
  const scrollToRef = useRef(scrollTo);

  useEffect(() => {
    handleScrollRef.current = handleScroll;
    scrollToHashSectionRef.current = scrollToHashSection;
    scrollToRef.current = scrollTo;
  }, [handleScroll, scrollToHashSection, scrollTo]);

  useEffect(() => {
    const rootElement = selfRef.current;

    // Query elements and store them in the ref, avoiding unnecessary re-renders
    if (rootElement) {
      anchorElementsRef.current = Array.from(
        rootElement.querySelectorAll(`[data-${dataAttribute}-anchor]`),
      );
    }

    const handleRootClick = (event: Event) => {
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest(`[data-${dataAttribute}-anchor]`);

      if (anchor instanceof HTMLElement) {
        scrollToRef.current(anchor)(event);
      }
    };

    rootElement?.addEventListener("click", handleRootClick);

    const onScroll = (event: Event) => {
      const scrollElement: HTMLElement | Window | null =
        targetRef?.current === document
          ? window
          : targetRef?.current instanceof HTMLElement
            ? targetRef.current
            : null;

      if (!scrollElement) return;

      const target = event.target;
      const isTargetNode = target instanceof Node;

      if (
        scrollElement === window ||
        (scrollElement instanceof HTMLElement && isTargetNode && scrollElement.contains(target))
      ) {
        handleScrollRef.current();
      }
    };

    // Use window listener with capture to catch scroll events from targetRef even if set later
    window.addEventListener("scroll", onScroll, true);

    // Check if there's a hash in the URL and scroll to the corresponding section
    const initialTimeout = setTimeout(() => {
      scrollToHashSectionRef.current();
      handleScrollRef.current();
    }, 100);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      rootElement?.removeEventListener("click", handleRootClick);
      clearTimeout(initialTimeout);
    };
  }, [targetRef, dataAttribute]);

  return (
    <div data-slot="scrollspy" className={className} ref={selfRef}>
      {children}
    </div>
  );
}
