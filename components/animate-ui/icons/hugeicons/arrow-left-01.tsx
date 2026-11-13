"use client";

import {
  getVariants,
  type IconProps,
  IconWrapper,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { m, type Variants } from "motion/react";
import * as React from "react";

type ArrowLeft01Props = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { x: 0, transition: { duration: 0.3, ease: "easeInOut" } },
      animate: { x: -4, transition: { duration: 0.3, ease: "easeInOut" } },
    },
  } satisfies Record<string, Variants>,
  "default-loop": {
    path1: {
      initial: { x: 0 },
      animate: {
        x: [0, -4, 0],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ArrowLeft01Props) {
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
        d="M15 6C15 6 9.00001 10.4189 9 12C8.99999 13.5812 15 18 15 18"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
    </m.svg>
  );
}

function ArrowLeft01(props: ArrowLeft01Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  ArrowLeft01,
  ArrowLeft01 as ArrowLeft01Icon,
  type ArrowLeft01Props,
  type ArrowLeft01Props as ArrowLeft01IconProps,
};
