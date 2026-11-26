import { Card } from "@/components/ui/card";
import { WifiAccessPointCard } from "./WifiAccessPointCard";
import { WifiNetworksSection } from "./WifiNetworksSection";

export default function WifiSection() {
  return (
    <div className="min-w-0 sm:bezel-shell">
      <Card className="bezel-core !gap-0 !p-4 sm:!p-6 lg:!p-7">
        <WifiNetworksSection />
        <div aria-hidden="true" className="my-7 border-t border-border-color/80" />
        <WifiAccessPointCard />
      </Card>
    </div>
  );
}
