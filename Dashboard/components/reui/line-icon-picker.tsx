"use client";

import { Search, Shapes, X } from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  getIconCatalogEntry,
  ICON_CATEGORIES,
  type IconCatalogEntry,
  type IconCategoryId,
  searchIconCatalog,
} from "@/features/iot/utils/iconCatalog";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { cn } from "@/lib/utils";

export interface LineIconPickerProps {
  value?: string;
  onSelect: (iconKey: string) => void;
  className?: string;
}

/**
 * Categorized, searchable Line Icon picker matching `@reui/emoji-picker` structure:
 * search bar -> folder tab bar -> sticky folder sections -> live preview footer.
 */
export function LineIconPicker({ value, onSelect, className }: LineIconPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<IconCategoryId>(ICON_CATEGORIES[0].id);
  const [hoveredEntry, setHoveredEntry] = useState<IconCatalogEntry | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const sectionRefs = useRef<Partial<Record<IconCategoryId, HTMLElement | null>>>({});

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  const searchResults = useMemo(
    () => (isSearching ? searchIconCatalog(trimmedQuery) : []),
    [isSearching, trimmedQuery],
  );

  const selectedEntry = useMemo(
    () => (value && hasIcon(value) ? getIconCatalogEntry(value) : undefined),
    [value],
  );

  const previewEntry = hoveredEntry ?? selectedEntry ?? null;

  const handleCategoryClick = useCallback((categoryId: IconCategoryId) => {
    setQuery("");
    setActiveCategory(categoryId);

    requestAnimationFrame(() => {
      const container = listRef.current;
      const sectionEl = sectionRefs.current[categoryId];
      if (!container || !sectionEl) return;

      container.scrollTo({
        top: sectionEl.offsetTop,
        behavior: "smooth",
      });
    });
  }, []);

  const handleListScroll = useCallback(() => {
    if (isSearching) return;
    const container = listRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop + 28;
    let currentId: IconCategoryId = ICON_CATEGORIES[0].id;

    for (const category of ICON_CATEGORIES) {
      const sectionEl = sectionRefs.current[category.id];
      if (sectionEl && sectionEl.offsetTop <= scrollTop) {
        currentId = category.id;
      }
    }

    setActiveCategory((prev) => (prev === currentId ? prev : currentId));
  }, [isSearching]);

  return (
    <div className={cn("flex min-h-0 w-full flex-col bg-card-bg-solid", className)}>
      <div className="shrink-0 px-3 pt-2.5 pb-2">
        <InputGroup className="h-10 rounded-xl bg-bg-main">
          <InputGroupAddon>
            <Search className="size-4 text-text-muted" aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجوی آیکون (چراغ، دما، قفل، lamp...)"
            aria-label="جستجوی آیکون خطی"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            className="text-right font-sans text-sm"
          />
          {query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                size="icon-xs"
                aria-label="پاک کردن جستجو"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
              >
                <X className="size-3.5" aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>

      <nav
        aria-label="پوشه‌های آیکون خطی"
        className="grid shrink-0 grid-cols-8 border-b border-border-color px-2"
      >
        {ICON_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          const isActive = !isSearching && activeCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategoryClick(category.id)}
              aria-label={category.label}
              aria-pressed={isActive}
              title={category.label}
              className={cn(
                "relative flex min-h-10 cursor-pointer items-center justify-center rounded-t-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                isActive
                  ? "text-accent3"
                  : "text-text-muted hover:bg-card-hover-bg hover:text-text-primary",
              )}
            >
              <CategoryIcon className="size-4.5" strokeWidth={1.85} aria-hidden="true" />
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-accent3"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div
        ref={listRef}
        onScroll={handleListScroll}
        role="listbox"
        aria-label="فهرست آیکون‌های خطی"
        className="relative h-[clamp(220px,44dvh,340px)] min-h-48 overflow-y-auto overscroll-contain custom-scrollbar"
      >
        {isSearching ? (
          searchResults.length > 0 ? (
            <section aria-label="نتایج جستجوی آیکون" className="pb-3">
              <div className="sticky top-0 z-10 flex items-center justify-between bg-card-bg-solid/95 px-3 py-2 text-xs font-semibold text-text-secondary backdrop-blur-xs">
                <span>نتایج جستجو</span>
                <span className="font-mono text-[11px] tabular-nums text-text-muted">
                  {searchResults.length}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 px-3 sm:grid-cols-8">
                {searchResults.map((item) => {
                  const isSelected = value === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-label={item.label}
                      title={`${item.label} (${item.key})`}
                      onMouseEnter={() => setHoveredEntry(item)}
                      onFocus={() => setHoveredEntry(item)}
                      onMouseLeave={() => setHoveredEntry(null)}
                      onClick={() => onSelect(item.key)}
                      className={cn(
                        "flex min-h-11 aspect-square cursor-pointer items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                        isSelected
                          ? "bg-accent3/15 text-accent3 ring-1 ring-accent3/50"
                          : "text-text-secondary hover:bg-card-hover-bg hover:text-text-primary",
                      )}
                    >
                      {React.createElement(getSegmentIcon(item.key), {
                        strokeWidth: 1.75,
                        className: "size-5",
                        "aria-hidden": true,
                      })}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <Empty className="h-full py-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search className="size-4" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-sm">آیکونی یافت نشد</EmptyTitle>
                <EmptyDescription className="text-xs">
                  عبارت فارسی یا انگلیسی دیگری امتحان کنید
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        ) : (
          <div className="pb-2">
            {ICON_CATEGORIES.map((category) => (
              <section
                key={category.id}
                ref={(node) => {
                  sectionRefs.current[category.id] = node;
                }}
                aria-labelledby={`icon-folder-${category.id}`}
                className="pb-2"
              >
                <div
                  id={`icon-folder-${category.id}`}
                  className="sticky top-0 z-10 flex items-center justify-between bg-card-bg-solid/95 px-3 py-2 text-xs font-semibold text-text-secondary backdrop-blur-xs"
                >
                  <span>{category.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-text-muted">
                    {category.items.length}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1.5 px-3 sm:grid-cols-8">
                  {category.items.map((item) => {
                    const isSelected = value === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-label={item.label}
                        title={`${item.label} (${item.key})`}
                        onMouseEnter={() => setHoveredEntry(item)}
                        onFocus={() => setHoveredEntry(item)}
                        onMouseLeave={() => setHoveredEntry(null)}
                        onClick={() => onSelect(item.key)}
                        className={cn(
                          "flex min-h-11 aspect-square cursor-pointer items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                          isSelected
                            ? "bg-accent3/15 text-accent3 ring-1 ring-accent3/50"
                            : "text-text-secondary hover:bg-card-hover-bg hover:text-text-primary",
                        )}
                      >
                        {React.createElement(getSegmentIcon(item.key), {
                          strokeWidth: 1.75,
                          className: "size-5",
                          "aria-hidden": true,
                        })}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-border-color px-3 select-none">
        {previewEntry ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent3/12 text-accent3">
                {React.createElement(getSegmentIcon(previewEntry.key), {
                  strokeWidth: 1.75,
                  className: "size-4",
                  "aria-hidden": true,
                })}
              </span>
              <span className="truncate text-xs font-semibold text-text-primary">
                {previewEntry.label}
              </span>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-text-muted" dir="ltr">
              {previewEntry.key}
            </span>
          </>
        ) : (
          <div className="flex min-w-0 items-center gap-2 text-text-muted">
            <Shapes className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate text-xs">یک آیکون انتخاب کنید</span>
          </div>
        )}
      </div>
    </div>
  );
}
