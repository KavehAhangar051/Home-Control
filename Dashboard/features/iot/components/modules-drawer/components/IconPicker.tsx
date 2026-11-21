import { DashboardIconPicker } from "@/components/reui/dashboard-icon-picker";

interface IconPickerProps {
  label: string;
  isOptional?: boolean;
  selectedIcon: string;
  onSelectIcon: (val: string) => void;
}

export default function IconPicker({
  label,
  isOptional = true,
  selectedIcon,
  onSelectIcon,
}: IconPickerProps) {
  return (
    <DashboardIconPicker
      label={label}
      isOptional={isOptional}
      selectedIcon={selectedIcon}
      onSelectIcon={onSelectIcon}
    />
  );
}
