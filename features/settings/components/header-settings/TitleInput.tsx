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
          className="text-xs theme-text-muted hover:text-[var(--text-primary)] transition-colors underline decoration-dotted cursor-pointer"
        >
          بازنشانی عنوان
        </button>
        <label
          htmlFor="dashboard-header-title"
          className="font-medium text-xs theme-text-secondary"
        >
          عنوان هدر
        </label>
      </div>
      <input
        id="dashboard-header-title"
        type="text"
        value={headerTitle}
        onChange={(e) => setHeaderTitle(e.target.value)}
        maxLength={50}
        className="w-full px-3 py-2.5 text-xs text-right bg-[var(--bg-main)] border border-[var(--border-color)] theme-text-primary rounded-lg focus:outline-none focus:border-[var(--accent3)] transition-colors"
        placeholder="مثال: کنترل‌گر هوشمند خانه"
      />
    </div>
  );
}
