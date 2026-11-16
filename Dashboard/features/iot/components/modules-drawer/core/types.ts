export interface Segment {
  id: string;
  type: string;
  pin: string;
  title: string;
  group?: string;
  icon?: string;
  mode?: "switch" | "push";
  auto_off?: number;
}
