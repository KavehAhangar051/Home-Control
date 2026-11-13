export interface MasterHeaderProps {
  setIsMenuOpen: (val: boolean) => void;
  headerTitle: string;
  animationsEnabled?: boolean;
  isSidebarCollapsed?: boolean;
  setIsSidebarCollapsed?: (val: boolean) => void;
}
