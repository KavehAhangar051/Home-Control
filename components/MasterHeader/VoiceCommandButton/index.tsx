import SidebarTooltip from "../SidebarTooltip";
import HorizontalVoiceButton from "./HorizontalVoiceButton";
import type { VoiceCommandButtonProps } from "./types";
import { useVoiceCommandHandler } from "./useVoiceCommandHandler";
import VerticalVoiceButton from "./VerticalVoiceButton";

export default function VoiceCommandButton(props: VoiceCommandButtonProps) {
  const handler = useVoiceCommandHandler();

  const button =
    props.variant === "vertical" && !props.isSidebarCollapsed ? (
      <VerticalVoiceButton {...props} {...handler} />
    ) : (
      <HorizontalVoiceButton {...props} {...handler} />
    );

  return (
    <SidebarTooltip label="فرمان صوتی (نگه دارید)" enabled>
      {button}
    </SidebarTooltip>
  );
}
