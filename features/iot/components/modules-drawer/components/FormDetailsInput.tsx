import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import IconPicker from "./IconPicker";

interface FormDetailsInputProps {
  customTitle: string;
  setCustomTitle: (val: string) => void;
  groupName: string;
  setGroupName: (val: string) => void;
  segmentIcon: string;
  setSegmentIcon: (val: string) => void;
  groupIcon: string;
  setGroupIcon: (val: string) => void;
  existingGroups: string[];
  lockedGroupName?: string;
}

export default function FormDetailsInput({
  customTitle,
  setCustomTitle,
  groupName,
  setGroupName,
  segmentIcon,
  setSegmentIcon,
  groupIcon,
  setGroupIcon,
  existingGroups,
  lockedGroupName,
}: FormDetailsInputProps) {
  const [isNewGroup, setIsNewGroup] = useState(existingGroups.length === 0);

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">(اختیاری)</span>
          <span className="text-xs text-text-secondary font-medium">عنوان دلخواه قطعه</span>
        </div>
        <Input
          aria-label="عنوان دلخواه قطعه"
          type="text"
          placeholder="مثال: رله پمپ آب حیاط"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          className="text-xs rounded-lg font-sans text-right"
        />
      </div>

      <IconPicker label="آیکون قطعه" selectedIcon={segmentIcon} onSelectIcon={setSegmentIcon} />

      <div className="space-y-1.5 pt-2 border-t border-border-color">
        <div className="text-xs text-text-secondary font-medium block">گروه قطعه</div>

        {lockedGroupName ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-accent3/30 bg-accent3/10 px-3 py-2 text-xs text-text-primary">
            <span className="font-medium truncate">{lockedGroupName}</span>
            <span className="shrink-0 text-[11px] text-text-muted">متصل به گروه برد کمکی</span>
          </div>
        ) : (
          <>
            {existingGroups.length > 0 && (
              <div className="flex items-center justify-end gap-3 mb-2 px-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="segment-group-mode"
                    checked={isNewGroup}
                    onChange={() => setIsNewGroup(true)}
                    className="appearance-none relative size-3.5 rounded-[4px] border border-border-color bg-bg-main checked:border-accent3 checked:bg-accent3 after:content-[''] after:absolute after:inset-[3px] after:rounded-[2px] after:bg-accent3-foreground after:opacity-0 checked:after:opacity-100 transition-colors cursor-pointer"
                  />
                  <span className="text-xs text-text-secondary">گروه جدید</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="segment-group-mode"
                    checked={!isNewGroup}
                    onChange={() => setIsNewGroup(false)}
                    className="appearance-none relative size-3.5 rounded-[4px] border border-border-color bg-bg-main checked:border-accent3 checked:bg-accent3 after:content-[''] after:absolute after:inset-[3px] after:rounded-[2px] after:bg-accent3-foreground after:opacity-0 checked:after:opacity-100 transition-colors cursor-pointer"
                  />
                  <span className="text-xs text-text-secondary">انتخاب از موجود</span>
                </label>
              </div>
            )}

            {!isNewGroup && existingGroups.length > 0 ? (
              <Select
                aria-label="گروه قطعه"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="text-xs rounded-lg font-sans"
                dir="rtl"
              >
                {existingGroups.map((group) => (
                  <option key={group} value={group} className="bg-bg-main">
                    {group}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="space-y-3">
                <Input
                  aria-label="نام گروه جدید"
                  type="text"
                  placeholder="مثال: پذیرایی"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="text-xs rounded-lg font-sans text-right"
                />

                <IconPicker
                  label="آیکون گروه جدید"
                  selectedIcon={groupIcon}
                  onSelectIcon={setGroupIcon}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
