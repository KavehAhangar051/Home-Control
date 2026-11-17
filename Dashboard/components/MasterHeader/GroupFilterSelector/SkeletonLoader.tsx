export default function SkeletonLoader({ isCompact }: { isCompact: boolean }) {
  return (
    <div
      className={`flex items-center justify-center pointer-events-auto max-w-full overflow-hidden ${!isCompact ? "mb-2" : ""}`}
      dir="rtl"
    >
      <div
        className={`flex flex-row items-center justify-center ${isCompact ? "gap-1" : "gap-2"} max-w-full`}
      >
        <div
          className={`${isCompact ? "size-4" : "size-6"} rounded-full bg-text-muted opacity-20 animate-pulse`}
        />
        <div
          className={`flex flex-row items-center justify-center ${isCompact ? "gap-1 p-1 max-w-[300px]" : "gap-2 p-1 max-w-[460px]"} relative`}
        >
          <div
            className={`${isCompact ? "w-[80px] h-5 rounded-md" : "w-[140px] h-12 rounded-2xl"} bg-card-bg-solid border border-border-color opacity-40 animate-pulse`}
          />
          <div
            className={`${isCompact ? "w-[80px] h-5 rounded-md" : "w-[140px] h-12 rounded-2xl"} bg-card-bg-solid border border-accent3 opacity-80 animate-pulse`}
          />
          <div
            className={`${isCompact ? "w-[80px] h-5 rounded-md" : "w-[140px] h-12 rounded-2xl"} bg-card-bg-solid border border-border-color opacity-40 animate-pulse`}
          />
        </div>
        <div
          className={`${isCompact ? "size-4" : "size-6"} rounded-full bg-text-muted opacity-20 animate-pulse`}
        />
      </div>
    </div>
  );
}
