interface AnimationStylesParams {
  isDark: boolean;
}

export function getAnimationStyles(_params: AnimationStylesParams): string {
  return `
    .golden-royal-text-shimmer {
      color: var(--text-primary);
    }

    .header-noble-glow {
      opacity: 1;
    }

    .footer-animated-border {
      border-color: var(--border-color);
    }

    .footer-animated-text {
      color: var(--text-muted);
    }
  `;
}
