import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const groupSelectId = `${baseId}-group-select`;
  const groupNewId = `${baseId}-group-new`;
  const [isNewGroup, setIsNewGroup] = useState(existingGroups.length === 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={titleId} className="text-sm font-bold text-text-primary">
              نام قطعه
            </Label>
            <span className="text-xs font-normal text-text-secondary">(اختیاری)</span>
          </div>
          <Input
            id={titleId}
            type="text"
            placeholder="مثال: چراغ پذیرایی یا پمپ حیاط"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="h-11 text-start font-sans text-base sm:text-sm"
          />
        </div>

        <IconPicker label="آیکون قطعه" selectedIcon={segmentIcon} onSelectIcon={setSegmentIcon} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label
            htmlFor={!isNewGroup && existingGroups.length > 0 ? groupSelectId : groupNewId}
            className="text-sm font-bold text-text-primary"
          >
            گروه و اتاق نمایش
          </Label>

          {!lockedGroupName && existingGroups.length > 0 && (
            <fieldset
              aria-label="نحوه انتخاب گروه"
              className="inline-grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-bg-main p-1"
            >
              <button
                type="button"
                aria-pressed={!isNewGroup}
                onClick={() => setIsNewGroup(false)}
                className={`min-h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 sm:text-[13px] ${
                  !isNewGroup
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                گروه موجود
              </button>
              <button
                type="button"
                aria-pressed={isNewGroup}
                onClick={() => setIsNewGroup(true)}
                className={`min-h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 sm:text-[13px] ${
                  isNewGroup
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                گروه جدید
              </button>
            </fieldset>
          )}
        </div>

        {lockedGroupName ? (
          <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border-color bg-bg-main px-3.5 py-2.5 text-sm text-text-primary">
            <span className="truncate font-bold">{lockedGroupName}</span>
            <span className="shrink-0 text-xs text-text-secondary">گروه اختصاصی برد کمکی</span>
          </div>
        ) : !isNewGroup && existingGroups.length > 0 ? (
          <Select
            id={groupSelectId}
            aria-label="انتخاب گروه موجود"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="h-11 font-sans text-base sm:text-sm"
            dir="rtl"
          >
            {existingGroups.map((group) => (
              <option key={group} value={group} className="bg-card-bg-solid">
                {group}
              </option>
            ))}
          </Select>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={groupNewId} className="block text-sm font-bold text-text-primary">
                نام گروه جدید
              </Label>
              <Input
                id={groupNewId}
                aria-label="نام گروه جدید"
                type="text"
                placeholder="مثال: پذیرایی، آشپزخانه، حیاط"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="h-11 text-start font-sans text-base sm:text-sm"
              />
            </div>

            <IconPicker
              label="آیکون گروه جدید"
              selectedIcon={groupIcon}
              onSelectIcon={setGroupIcon}
            />
          </div>
        )}
      </div>
    </div>
  );
}
