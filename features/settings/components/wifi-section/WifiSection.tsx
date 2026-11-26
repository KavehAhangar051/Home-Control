import { WifiAccessPointCard } from "./WifiAccessPointCard";
import { WifiNetworksSection } from "./WifiNetworksSection";

export default function WifiSection() {
  return (
    <div className="space-y-7">
      <WifiNetworksSection />
      <WifiAccessPointCard />
    </div>
  );
}
