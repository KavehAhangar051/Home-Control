export function getBaseStyles(isDark: boolean): string {
  return `

    /* Custom cursor personalizations */
    html, body {
      cursor: auto;
    }
    a, button, select, input, [role="button"], .cursor-pointer, [draggable="true"] {
      cursor: pointer;
    }

    /* Dropdown, Input, & Form Controls */
    select, input, textarea {
      transition: border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1) !important;
    }
    select:focus, input:focus, textarea:focus {
      border-color: var(--accent3) !important;
      box-shadow: none !important;
      outline: none;
    }
    @media (min-width: 768px) {
      select:hover, input:hover {
        border-color: var(--accent3-medium) !important;
      }
    }
    select option {
      background-color: ${isDark ? "#19191b" : "#ffffff"} !important;
      color: ${isDark ? "var(--text-primary)" : "#171717"} !important;
      padding: 12px !important;
      font-size: 13px !important;
    }

    /* Custom Royal scrollbar styling */
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
    @media (min-width: 768px) {
      ::-webkit-scrollbar-thumb:hover {
        background: var(--accent3);
      }
    }
  `;
}
