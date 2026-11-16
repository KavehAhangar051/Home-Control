import { AmbientManager } from "./AmbientManager";
import {
  playClickSynth,
  playErrorSynth,
  playSuccessSynth,
  playToggleOffSynth,
  playToggleOnSynth,
} from "./effects";
import type { Track } from "./types";

export interface SoundManagerSynths {
  playClick: () => void;
  playToggleOn: () => void;
  playToggleOff: () => void;
  playSuccess: () => void;
  playError: () => void;
}

export interface SoundManagerDeps {
  ambientManager?: AmbientManager;
  synths?: Partial<SoundManagerSynths>;
}

export class SoundManager {
  private enabled = true;
  private readonly ambientManager: AmbientManager;
  private readonly synths: SoundManagerSynths;

  constructor(deps: SoundManagerDeps = {}) {
    this.ambientManager = deps.ambientManager ?? new AmbientManager();
    this.synths = {
      playClick: deps.synths?.playClick ?? playClickSynth,
      playToggleOn: deps.synths?.playToggleOn ?? playToggleOnSynth,
      playToggleOff: deps.synths?.playToggleOff ?? playToggleOffSynth,
      playSuccess: deps.synths?.playSuccess ?? playSuccessSynth,
      playError: deps.synths?.playError ?? playErrorSynth,
    };
  }

  get isAmbientPlaying() {
    return this.ambientManager.isAmbientPlaying;
  }
  get currentTrack() {
    return this.ambientManager.currentTrack;
  }
  get playlist() {
    return this.ambientManager.playlist;
  }
  get currentTrackIndex() {
    return this.ambientManager.currentTrackIndex;
  }

  public setOnTrackUpdate(cb: (track: Track) => void) {
    this.ambientManager.setOnTrackUpdate(cb);
  }

  public async loadAmbientTrack() {
    await this.ambientManager.loadAmbientTrack();
  }

  public async nextTrack() {
    await this.ambientManager.loadAmbientTrack("next");
  }

  public async prevTrack() {
    await this.ambientManager.loadAmbientTrack("prev");
  }

  public setEnabled(val: boolean) {
    this.enabled = val;

    if (!val && this.isAmbientPlaying) this.ambientManager.stop();
  }

  public async toggleAmbient() {
    if (this.isAmbientPlaying) {
      this.stopAmbient();
    } else {
      await this.startAmbient();
    }

    return this.isAmbientPlaying;
  }

  public async startAmbient() {
    await this.ambientManager.start(this.enabled);
  }

  public stopAmbient() {
    this.ambientManager.stop();
  }

  public playClick() {
    if (this.enabled) this.synths.playClick();
  }

  public playToggleOn() {
    if (this.enabled) this.synths.playToggleOn();
  }

  public playToggleOff() {
    if (this.enabled) this.synths.playToggleOff();
  }

  public playSuccess() {
    if (this.enabled) this.synths.playSuccess();
  }

  public playError() {
    if (this.enabled) this.synths.playError();
  }
}
