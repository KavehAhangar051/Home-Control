import type { VoiceCommandButtonProps } from "./types";
import { useVoiceCommandHandler } from "./useVoiceCommandHandler";
import VerticalVoiceButton from "./VerticalVoiceButton";
import HorizontalVoiceButton from "./HorizontalVoiceButton";
import SidebarTooltip from "../SidebarTooltip";

export default function VoiceCommandButton(props: VoiceCommandButtonProps) {
  const handler = useVoiceCommandHandler();

  if (props.variant === "vertical" && !props.isSidebarCollapsed) {
    return <VerticalVoiceButton {...props} {...handler} />;
  }

  const button = <HorizontalVoiceButton {...props} {...handler} />;

  if (props.variant === "vertical" && props.isSidebarCollapsed) {
    return <SidebarTooltip label="فرمان صوتی (نگه دارید)" enabled>{button}</SidebarTooltip>;
  }

  return button;
}
