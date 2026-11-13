"use client";

import {
  getVariants,
  type IconProps,
  IconWrapper,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { m, type Variants } from "motion/react";
import * as React from "react";

type ArrowDown01Props = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { y: 0, transition: { duration: 0.3, ease: "easeInOut" } },
      animate: { y: 4, transition: { duration: 0.3, ease: "easeInOut" } },
    },
  } satisfies Record<string, Variants>,
  "default-loop": {
    path1: {
      initial: { y: 0 },
      animate: {
        y: [0, 4, 0],
        transition: { duration: 0.6, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ArrowDown01Props) {
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
        d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
    </m.svg>
  );
}

function ArrowDown01(props: ArrowDown01Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  ArrowDown01,
  ArrowDown01 as ArrowDown01Icon,
  type ArrowDown01Props,
  type ArrowDown01Props as ArrowDown01IconProps,
};
