"use client";

import {
  getVariants,
  type IconProps,
  IconWrapper,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { m, type Variants } from "motion/react";
import * as React from "react";

type Clock03Props = IconProps<keyof typeof animations>;

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

function IconComponent({ size, ...props }: Clock03Props) {
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
      <m.path
        d="M18.952 8.60639L21.4621 8.45358C19.6628 3.70459 14.497 0.999731 9.46036 2.34456C4.09594 3.77692 0.909585 9.26089 2.34343 14.5933C3.77727 19.9258 9.28834 23.0874 14.6528 21.6551C18.6358 20.5916 21.418 17.2945 22 13.4842"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.face1}
        initial="initial"
        animate={controls}
      />
      <m.path
        d="M12 7.99982L12 11.9998"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.minute}
        initial="initial"
        animate={controls}
      />
      <m.path
        d="M14 13.9998L12 11.9998"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.hour}
        initial="initial"
        animate={controls}
      />
    </m.svg>
  );
}

function Clock03(props: Clock03Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  Clock03,
  Clock03 as Clock03Icon,
  type Clock03Props,
  type Clock03Props as Clock03IconProps,
};
