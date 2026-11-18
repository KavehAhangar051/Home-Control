import type { GroupsSlice, Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";

export interface AddSegmentInput {
  type: string;
  pin: string;
  title?: string;
  group?: string;
  mode?: "switch" | "push";
  auto_off?: number;
  icon?: string;
  groupIcon?: string;
}

export type AddSegmentDecision =
  | { ok: false; errorMessage: string }
  | {
      ok: true;
      newSegment: Segment;
      finalGroup: string;
      nextSegments: Segment[];
      replacedPlaceholder: boolean;
    };

export function createSegmentId(randomFn: () => number = Math.random): string {
  return randomFn().toString(36).substring(2, 9);
}

/**
 * Pure domain decision for adding or replacing a placeholder segment.
 * Enforces hardware GPIO validation, preserves placeholder group ownership,
 * and formats deterministic default titles.
 */
export function planAddSegment(params: {
  input: AddSegmentInput;
  segments: readonly Segment[];
  targetPlaceholderId: string | null;
  createId?: () => string;
}): AddSegmentDecision {
  const { input, segments, targetPlaceholderId, createId = createSegmentId } = params;

  if (input.pin && input.type !== "placeholder") {
    const validation = validateEsp32Pin(input.pin, input.type);

    if (!validation.isValid) {
      return { ok: false, errorMessage: validation.message };
    }
  }

  const finalGroup = resolveSegmentGroup(input.group);

  const newSegment: Segment = {
    id: createId(),
    type: input.type,
    pin: input.pin,
    title: input.title || `کنترل پایه دیجیتال (GPIO ${input.pin})`,
    group: finalGroup,
    mode: input.mode || "switch",
    auto_off: input.auto_off || 0,
    icon: input.icon,
  };

  const nextSegments = [...segments];
  let replacedPlaceholder = false;

  if (targetPlaceholderId) {
    const index = nextSegments.findIndex((s) => s.id === targetPlaceholderId);

    if (index !== -1) {
      newSegment.group = resolveSegmentGroup(nextSegments[index].group);
      nextSegments[index] = newSegment;
      replacedPlaceholder = true;
    } else {
      nextSegments.push(newSegment);
    }
  } else {
    nextSegments.push(newSegment);
  }

  return {
    ok: true,
    newSegment,
    finalGroup,
    nextSegments,
    replacedPlaceholder,
  };
}

export function planGroupConfigRegistration(
  prev: GroupsSlice["groupConfigs"],
  finalGroup: string,
  groupIcon?: string,
): GroupsSlice["groupConfigs"] {
  const current = prev[finalGroup] || { maxCols: 3 };

  if (groupIcon && !("icon" in current && current.icon)) {
    return { ...prev, [finalGroup]: { ...current, icon: groupIcon } };
  }

  if (!prev[finalGroup]) {
    return { ...prev, [finalGroup]: current };
  }

  return prev;
}

export function planGroupOrderRegistration(prev: readonly string[], finalGroup: string): string[] {
  return prev.includes(finalGroup) ? [...prev] : [...prev, finalGroup];
}

export interface RemoveGroupPlan {
  nextGroupsOrder: string[];
  nextSegments: Segment[];
}

export function planRemoveGroup(params: {
  groupsOrder: readonly string[];
  segments: readonly Segment[];
  groupId: string;
}): RemoveGroupPlan {
  return {
    nextGroupsOrder: params.groupsOrder.filter((g) => g !== params.groupId),
    nextSegments: params.segments.filter((s) => resolveSegmentGroup(s.group) !== params.groupId),
  };
}

export function validateRuleActionList(
  actions?: Array<{
    targetPin: string;
    reqHold?: number;
    actionType?: number;
    delay?: number;
  }>,
): string | null {
  if (!actions) return null;
  if (actions.length > 4) return "هر حالت حداکثر می‌تواند ۴ عملیات داشته باشد.";

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const targetPin = action.targetPin;

    if (!targetPin) return "برای هر عملیات باید پایه خروجی مقصد انتخاب شود.";
    const validation = validateEsp32Pin(targetPin, "output");
    if (!validation.isValid) return validation.message;

    if (
      action.reqHold !== undefined &&
      action.reqHold !== 0 &&
      action.reqHold !== 3 &&
      action.reqHold !== 5 &&
      action.reqHold !== 10
    ) {
      return "زمان نگه‌داشتن باید یکی از مقادیر ۰، ۳، ۵ یا ۱۰ ثانیه باشد.";
    }

    if (
      action.actionType !== undefined &&
      action.actionType !== 0 &&
      action.actionType !== 1 &&
      action.actionType !== 2
    ) {
      return "نوع عملیات انتخاب‌شده معتبر نیست.";
    }

    if (
      action.delay !== undefined &&
      (!Number.isInteger(action.delay) || action.delay < 0 || action.delay > 60)
    ) {
      return "تأخیر عملیات باید بین ۰ تا ۶۰ ثانیه باشد.";
    }
  }

  return null;
}
