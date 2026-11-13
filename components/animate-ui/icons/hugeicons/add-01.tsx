"use client";

import {
  getVariants,
  type IconProps,
  IconWrapper,
  useAnimateIconContext,
} from "@animate-ui/react/icons";
import { m, type Variants } from "motion/react";
import * as React from "react";

type Add01Props = IconProps<keyof typeof animations>;

const animations = {
  default: {
    line1: {
      initial: {
        rotate: 0,
        transition: { duration: 0.4, ease: "easeInOut", delay: 0.1 },
      },
      animate: {
        rotate: 90,
        transition: { duration: 0.4, ease: "easeInOut", delay: 0.1 },
      },
    },
    line2: {
      initial: { rotate: 0, transition: { duration: 0.4, ease: "easeInOut" } },
      animate: { rotate: 90, transition: { duration: 0.4, ease: "easeInOut" } },
    },
  } satisfies Record<string, Variants>,
  x: {
    line1: {
      initial: { rotate: 0, scale: 1 },
      animate: {
        rotate: 45,
        scale: 1.2,
        transition: { duration: 0.3, ease: "easeInOut", delay: 0.1 },
      },
    },
    line2: {
      initial: { rotate: 0, scale: 1 },
      animate: {
        rotate: 45,
        scale: 1.2,
        transition: { duration: 0.3, ease: "easeInOut" },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: Add01Props) {
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
        d="M12.001 5.00003V19.002"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.line1}
        initial="initial"
        animate={controls}
      />
      <m.path
        d="M19.002 12.002L4.99998 12.002"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={variants.line2}
        initial="initial"
        animate={controls}
      />
    </m.svg>
  );
}

function Add01(props: Add01Props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { Add01, Add01 as Add01Icon, type Add01Props, type Add01Props as Add01IconProps };
