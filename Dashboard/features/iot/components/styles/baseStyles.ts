export function getBaseStyles(_isDark: boolean): string {
  return `
    /* Cursor semantics: interactive buttons/controls get pointer, text fields stay text */
    html, body {
      cursor: auto;
    }
    a, button, select, input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"], input[type="reset"], input[type="range"], input[type="color"], [role="button"], .cursor-pointer, [draggable="true"] {
      cursor: pointer;
    }
    input[type="text"], input[type="search"], input[type="url"], input[type="password"], input[type="email"], input[type="number"], textarea {
      cursor: text;
    }

    /* Dropdown, Input, & Form Controls — preserve visible WCAG focus rings and invalid states */
    select, input, textarea {
      transition: border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1);
    }
    select:focus-visible:not([aria-invalid="true"]),
    input:focus-visible:not([aria-invalid="true"]),
    textarea:focus-visible:not([aria-invalid="true"]) {
      border-color: var(--accent3);
      outline: 2px solid color-mix(in oklab, var(--accent3) 30%, transparent);
      outline-offset: 0px;
    }
    @media (hover: hover) and (pointer: fine) {
      select:hover:not(:disabled), input:hover:not(:disabled), textarea:hover:not(:disabled) {
        border-color: var(--accent3-medium);
      }
    }
    select option {
      background-color: var(--card-bg-solid);
      color: var(--text-primary);
      padding: 12px;
      font-size: 13px;
    }

    /* Standard & WebKit scrollbar styling synced to theme tokens */
    * {
      scrollbar-width: thin;
      scrollbar-color: var(--accent3-medium) transparent;
    }
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: var(--bg-main);
    }
    ::-webkit-scrollbar-thumb {
      background: var(--accent3-medium);
      border-radius: 4px;
      border: 2px solid var(--bg-main);
    }
    @media (hover: hover) and (pointer: fine) {
      ::-webkit-scrollbar-thumb:hover {
        background: var(--accent3);
      }
    }
  `;
}
