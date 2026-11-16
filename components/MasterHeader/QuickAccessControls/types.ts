export interface QuickAccessControlsProps {
  setIsMenuOpen: (val: boolean) => void;
  animationsEnabled?: boolean;
  variant: "vertical" | "horizontal";
  isSidebarCollapsed?: boolean;
  setIsSidebarCollapsed?: (val: boolean) => void;
}
