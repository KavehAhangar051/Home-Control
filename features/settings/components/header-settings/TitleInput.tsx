import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TitleInputProps {
  headerTitle: string;
  setHeaderTitle: (val: string) => void;
}

export default function TitleInput({ headerTitle, setHeaderTitle }: TitleInputProps) {
  const handleResetTitle = () => setHeaderTitle("کنترل‌گر هوشمند خانه");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleResetTitle}
          className="text-xs text-text-muted hover:text-text-primary transition-colors underline decoration-dotted cursor-pointer"
        >
          بازنشانی عنوان
        </button>
        <Label htmlFor="dashboard-header-title" className="font-medium text-xs text-text-secondary">
          عنوان هدر
        </Label>
      </div>
      <Input
        id="dashboard-header-title"
        type="text"
        value={headerTitle}
        onChange={(e) => setHeaderTitle(e.target.value)}
        maxLength={50}
        className="w-full px-3 py-2.5 text-xs text-right bg-bg-main border-border-color text-text-primary rounded-lg focus:border-accent3"
        placeholder="مثال: کنترل‌گر هوشمند خانه"
      />
    </div>
  );
}
