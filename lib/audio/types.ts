export interface Track {
  title: string;
  creator: string;
  url: string;
  isLocal: boolean;
}

export interface ArchiveTrackItem {
  identifier: string;
  title?: string;
  creator?: string;
}
