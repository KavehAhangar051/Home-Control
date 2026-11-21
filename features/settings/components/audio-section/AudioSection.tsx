import { useEffect, useState, useSyncExternalStore } from "react";
import { soundManager } from "@/lib/audio";
import { debugLog } from "@/lib/debug";
import { AudioToggleButton } from "./AudioToggleButton";
import { AudioTrackInfo } from "./AudioTrackInfo";

const subscribeAudioSnapshot = () => () => {};
const getInitialIsMusicOn = () => soundManager.isAmbientPlaying;
const getServerIsMusicOn = () => false;
const getInitialTrackInfo = () => soundManager.currentTrack;
const getServerTrackInfo = () => null;

async function runAudioTask(
  setIsLoading: (val: boolean) => void,
  setPlaybackError: (err: string | null) => void,
  logContext: string,
  userErrorMessage: string,
  task: () => Promise<void>,
  onErrorCallback?: () => void,
): Promise<void> {
  setIsLoading(true);
  setPlaybackError(null);

  try {
    await task();
  } catch (error) {
    debugLog.error("AudioUI", logContext, error);
    setPlaybackError(userErrorMessage);
    onErrorCallback?.();
  } finally {
    setIsLoading(false);
  }
}

export default function AudioSection() {
  const initialMusicOn = useSyncExternalStore(
    subscribeAudioSnapshot,
    getInitialIsMusicOn,
    getServerIsMusicOn,
  );

  const initialTrackInfo = useSyncExternalStore(
    subscribeAudioSnapshot,
    getInitialTrackInfo,
    getServerTrackInfo,
  );

  const [musicOnOverride, setMusicOnOverride] = useState<boolean | null>(null);
  const [trackInfoOverride, setTrackInfoOverride] = useState<
    ReturnType<typeof getInitialTrackInfo> | undefined
  >(undefined);

  const [isLoading, setIsLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const isMusicOn = musicOnOverride ?? initialMusicOn;
  const trackInfo = trackInfoOverride === undefined ? initialTrackInfo : trackInfoOverride;

  useEffect(() => {
    const handleMusicStart = () => {
      setMusicOnOverride(soundManager.isAmbientPlaying);
      setPlaybackError(null);
    };

    const handleMusicError = (event: Event) => {
      // SAFETY: ambientMusicError event is dispatched as CustomEvent<{ message?: string }>
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMusicOnOverride(false);
      setIsLoading(false);
      setPlaybackError(detail?.message || "پخش آهنگ ناموفق بود.");
    };

    window.addEventListener("ambientMusicStarted", handleMusicStart);
    window.addEventListener("ambientMusicError", handleMusicError);
    soundManager.setOnTrackUpdate((track) => {
      setTrackInfoOverride(track);
      setIsLoading(false);
    });

    return () => {
      window.removeEventListener("ambientMusicStarted", handleMusicStart);
      window.removeEventListener("ambientMusicError", handleMusicError);
      soundManager.setOnTrackUpdate(() => {});
    };
  }, []);

  const handleToggle = async () => {
    await runAudioTask(
      setIsLoading,
      setPlaybackError,
      "Playback button action failed.",
      "پخش آهنگ ناموفق بود. اتصال اینترنت و کنسول مرورگر را بررسی کن.",
      async () => {
        const newState = await soundManager.toggleAmbient();
        setMusicOnOverride(newState);

        if (newState) soundManager.playToggleOn();
        else soundManager.playToggleOff();
      },
      () => setMusicOnOverride(false),
    );
  };

  const handleNext = async () => {
    soundManager.playClick();
    await runAudioTask(
      setIsLoading,
      setPlaybackError,
      "Could not play next track.",
      "آهنگ بعدی در دسترس نیست.",
      () => soundManager.nextTrack(),
    );
  };

  const handlePrev = async () => {
    soundManager.playClick();
    await runAudioTask(
      setIsLoading,
      setPlaybackError,
      "Could not play previous track.",
      "آهنگ قبلی در دسترس نیست.",
      () => soundManager.prevTrack(),
    );
  };

  return (
    <div className="space-y-6">
      <AudioToggleButton isMusicOn={isMusicOn} isLoading={isLoading} onToggle={handleToggle} />
      {playbackError && (
        <p role="alert" className="text-xs text-destructive text-right" aria-live="polite">
          {playbackError}
        </p>
      )}
      {isMusicOn && trackInfo && (
        <AudioTrackInfo
          trackInfo={trackInfo}
          isLoading={isLoading}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      )}
    </div>
  );
}
