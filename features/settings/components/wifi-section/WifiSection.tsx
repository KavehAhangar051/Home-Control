import { WifiAccessPointCard } from "./WifiAccessPointCard";
import { WifiNetworksSection } from "./WifiNetworksSection";

export default function WifiSection() {
  return (
    <div className="min-w-0 space-y-9">
      <WifiNetworksSection />
      <div className="border-t border-border-color/70 pt-8">
        <WifiAccessPointCard />
      </div>
    </div>
  );
}
