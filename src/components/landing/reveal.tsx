"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/** True only on devices with a precise, hover-capable pointer (mouse/trackpad). */
function useHoverCapable() {
  const [hoverable, setHoverable] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setHoverable(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setHoverable(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return hoverable;
}

/**
 * Lightweight, reduced-motion-aware entrance primitives for the landing page.
 *
 * - <Reveal>        single element fade + slide, on mount or when scrolled into view
 * - <RevealStagger> container that choreographs its <RevealItem> children
 * - <RevealItem>    a child of <RevealStagger>; inherits the parent's trigger
 *
 * All three are polymorphic via `as` so they replace the original element
 * (no extra wrapper divs, so spacing/margins are preserved). When the user
 * prefers reduced motion, content renders instantly with no transform.
 */

// Confident ease-out — settles decisively without bounce.
const EASE = [0.16, 1, 0.3, 1] as const;

const TAGS = {
  div: motion.div,
  span: motion.span,
  section: motion.section,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  li: motion.li,
  ul: motion.ul,
} as const;

type Tag = keyof typeof TAGS;
type Trigger = "mount" | "inView";

export function Reveal({
  children,
  className,
  as = "div",
  trigger = "inView",
  delay = 0,
  y = 16,
  duration = 0.6,
  blur = 0,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  trigger?: Trigger;
  delay?: number;
  y?: number;
  duration?: number;
  /** initial blur in px, cleared to 0 — adds weight to hero-level elements */
  blur?: number;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  const Comp = TAGS[as];

  const initial = reduce
    ? false
    : { opacity: 0, y, ...(blur ? { filter: `blur(${blur}px)` } : {}) };
  const shown = { opacity: 1, y: 0, ...(blur ? { filter: "blur(0px)" } : {}) };
  const transition = { duration, ease: EASE, delay };

  const triggerProps =
    trigger === "mount"
      ? { initial, animate: shown }
      : {
          initial,
          whileInView: shown,
          viewport: { once: true, amount },
        };

  return (
    <Comp className={className} transition={transition} {...triggerProps}>
      {children}
    </Comp>
  );
}

export function RevealStagger({
  children,
  className,
  as = "div",
  trigger = "inView",
  delay = 0.05,
  stagger = 0.09,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  trigger?: Trigger;
  delay?: number;
  stagger?: number;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  const Comp = TAGS[as];

  const variants: Variants = {
    hidden: {},
    show: {
      transition: reduce
        ? {}
        : { staggerChildren: stagger, delayChildren: delay },
    },
  };

  const triggerProps =
    trigger === "mount"
      ? { initial: "hidden", animate: "show" }
      : {
          initial: "hidden",
          whileInView: "show",
          viewport: { once: true, amount },
        };

  return (
    <Comp className={className} variants={variants} {...triggerProps}>
      {children}
    </Comp>
  );
}

export function RevealItem({
  children,
  className,
  as = "div",
  y = 18,
  duration = 0.55,
  lift = false,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  y?: number;
  duration?: number;
  /** add a subtle hover lift (skipped under reduced motion) */
  lift?: boolean;
}) {
  const reduce = useReducedMotion();
  const hoverable = useHoverCapable();
  const Comp = TAGS[as];

  const variants: Variants = reduce
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration, ease: EASE } },
      };

  // Gate the hover lift to hover-capable pointers — on touch, whileHover
  // sticks after a tap and the card stays lifted.
  const hoverProps =
    lift && !reduce && hoverable
      ? { whileHover: { y: -4, transition: { duration: 0.2, ease: EASE } } }
      : {};

  return (
    <Comp className={className} variants={variants} {...hoverProps}>
      {children}
    </Comp>
  );
}
