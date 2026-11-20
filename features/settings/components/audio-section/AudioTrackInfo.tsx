import { Download, Music, SkipBack, SkipForward } from "@/components/ui/hugeicons-groups/media";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AudioTrack {
  title: string;
  creator: string;
  isLocal: boolean;
  url: string;
}

interface Props {
  trackInfo: AudioTrack | null;
  isLoading: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export function AudioTrackInfo({ trackInfo, isLoading, onNext, onPrev }: Props) {
  if (!trackInfo) return null;

  return (
    <div className="p-4 bg-card-bg-solid border border-border-color rounded-xl flex items-center justify-between">
      <div className="flex items-center gap-3 max-w-[70%]">
        <div className="size-8 shrink-0 rounded-full bg-accent3-transparent flex items-center justify-center">
          <Music aria-hidden="true" className="size-4 text-accent3" />
        </div>
        <div className="text-right overflow-hidden">
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="block text-xs font-bold text-text-primary truncate">
                  {trackInfo.title}
                </span>
              }
            />
            <TooltipContent>{trackInfo.title}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="block text-[10px] text-text-muted mt-0.5 truncate">
                  {trackInfo.creator}
                </span>
              }
            />
            <TooltipContent>{trackInfo.creator}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!trackInfo.isLocal && (
          <div className="flex items-center gap-1 ml-2 rtl:mr-2 rtl:ml-0">
            <button
              type="button"
              aria-label="آهنگ قبلی"
              onClick={onPrev}
              disabled={isLoading}
              className="p-1.5 rounded bg-card-hover-bg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <SkipBack aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="آهنگ بعدی"
              onClick={onNext}
              disabled={isLoading}
              className="p-1.5 rounded bg-card-hover-bg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <SkipForward aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        )}
        {!trackInfo.isLocal && (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={trackInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="دانلود موزیک"
                  className="p-1.5 rounded bg-bg-main text-text-secondary hover:text-accent3 transition-colors"
                >
                  <Download aria-hidden="true" className="size-3.5" />
                </a>
              }
            />
            <TooltipContent>دانلود موزیک</TooltipContent>
          </Tooltip>
        )}
        <div className="flex gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((bar) => (
            <div
              key={bar}
              className="w-1 h-3 bg-accent3 rounded-full animate-pulse transform-gpu will-change-[opacity,transform] opacity-60"
              style={{ animationDelay: `${bar * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
