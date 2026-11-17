import { m } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DURATION, EASE_IN, EASE_OUT, EXIT_DURATION } from "@/lib/ease";

interface FilterButtonProps {
  group: string | null;
  isCenter: boolean;
  onClick: () => void;
  uniqueKey: string;
  animationsEnabled: boolean;
  direction: number;
  isCompact: boolean;
}

export default function FilterButton({
  group,
  isCenter,
  onClick,
  uniqueKey,
  animationsEnabled,
  direction,
  isCompact,
}: FilterButtonProps) {
  const getLabel = (item: string | null) =>
    item === null ? "همه گروه‌ها" : item || "گروه بدون نام";

  const label = getLabel(group);

  return (
    <Tooltip key={uniqueKey}>
      <TooltipTrigger
        render={
          <m.button
            layout
            initial={
              animationsEnabled
                ? {
                    opacity: 0,
                    scale: 0.8,
                    x: direction * 40,
                  }
                : undefined
            }
            animate={
              animationsEnabled
                ? {
                    opacity: isCenter ? 1 : 0.4,
                    scale: isCenter ? 1 : 0.85,
                    x: 0,
                    y: 0,
                  }
                : undefined
            }
            exit={
              animationsEnabled
                ? {
                    opacity: 0,
                    scale: 0.85,
                    x: -direction * 40,
                    transition: { duration: EXIT_DURATION.standard, ease: EASE_IN },
                  }
                : undefined
            }
            transition={
              animationsEnabled ? { duration: DURATION.standard, ease: EASE_OUT } : undefined
            }
            whileTap={animationsEnabled ? { scale: 0.97 } : undefined}
            onClick={onClick}
            className={`flex items-center justify-center border ${
              isCompact
                ? "rounded-lg h-7 min-w-[76px] max-w-[136px] gap-1.5 px-2.5"
                : "rounded-xl h-9 w-[140px] gap-2 px-3.5"
            } ${
              isCenter
                ? "bg-card-hover-bg border-border-color text-text-primary font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] z-10"
                : "hidden md:flex bg-card-bg-solid border-border-color text-text-muted font-normal md:hover:bg-card-hover-bg md:hover:text-text-secondary"
            } transition-[border-color,color,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] relative group flex-row whitespace-nowrap overflow-hidden shrink-0 cursor-pointer`}
            aria-label={label}
          >
            <span className="text-xs leading-none truncate max-w-full">{label}</span>
          </m.button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
