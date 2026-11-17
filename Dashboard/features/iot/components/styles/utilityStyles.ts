interface UtilityStylesParams {
  isDark: boolean;
  animationsEnabled: boolean;
}

export function getUtilityStyles({ animationsEnabled }: UtilityStylesParams): string {
  return `
    /* Active Performance Settings - Disabling CSS animations on demand */
    ${
      !animationsEnabled
        ? `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        animation-iteration-count: 1 !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        animation: none !important;
        transition: none !important;
      }
    `
        : ""
    }
  `;
}
