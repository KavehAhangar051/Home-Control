"use client";

import {
  getVariants,
  type IconProps,
  IconWrapper,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { m, type Variants } from "motion/react";
import * as React from "react";

type Clock01Props = IconProps<keyof typeof animations>;

const animations = {
  default: {
    face1: {},
    minute: {
      initial: {
        rotate: 0,
        transformOrigin: "50% 100%",
        transition: { duration: 0.6, ease: "easeInOut" },
      },
      animate: {
        rotate: 360,
        transformOrigin: "50% 100%",
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
    hour: {
      initial: {
        rotate: 0,
        transformOrigin: "0% 0%",
        transition: { duration: 0.6, ease: "easeInOut" },
      },
      animate: {
        rotate: [0, 20, 0],
        transformOrigin: "0% 0%",
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: Clock01Props) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <m.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      {...props}
    >
      <m.circle
        cx={12}
        cy={12}
        r={10}
        variants={variants.face1}
        initial="initial"
        animate={controls}
      />
      <m.path
        d="M12 8L12 12"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.minute}
        initial="initial"
        animate={controls}
      />
      <m.path
        d="M14 14L12 12"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.hour}
        initial="initial"
        animate={controls}
      />
    </m.svg>
  );
}

function Clock01(props: Clock01Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Clock01,
  Clock01 as Clock01Icon,
  type Clock01Props,
  type Clock01Props as Clock01IconProps,
};
