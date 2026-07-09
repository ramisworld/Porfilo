"use client";

/**
 * ShinyText — a light sweep across text via an animated gradient clip.
 *
 * Adapted for Porfilo from ReactBits (https://reactbits.dev) by David Haz,
 * MIT + Commons Clause. Used here as part of our own website (permitted).
 * Change: honors prefers-reduced-motion (static, no sweep).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from "motion/react";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  spread?: number;
  pauseOnHover?: boolean;
  direction?: "left" | "right";
  delay?: number;
}

const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 3,
  className = "",
  color = "rgba(255,255,255,0.55)",
  shineColor = "#ffffff",
  spread = 120,
  pauseOnHover = false,
  direction = "left",
  delay = 0,
}) => {
  const reduce = useReducedMotion();
  const isDisabled = disabled || !!reduce;
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const directionRef = useRef(direction === "left" ? 1 : -1);

  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useAnimationFrame((time) => {
    if (isDisabled || isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    const cycleDuration = animationDuration + delayDuration;
    const cycleTime = elapsedRef.current % cycleDuration;
    if (cycleTime < animationDuration) {
      const p = (cycleTime / animationDuration) * 100;
      progress.set(directionRef.current === 1 ? p : 100 - p);
    } else {
      progress.set(directionRef.current === 1 ? 100 : 0);
    }
  });

  useEffect(() => {
    directionRef.current = direction === "left" ? 1 : -1;
    elapsedRef.current = 0;
    progress.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  const backgroundPosition = useTransform(progress, (p) => `${150 - p * 2}% center`);

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);
  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  const gradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };

  // Reduced motion / disabled: hold the shine off-screen, just show base color.
  if (isDisabled) {
    return (
      <span
        className={`inline-block ${className}`}
        style={{ ...gradientStyle, backgroundPosition: "150% center" }}
      >
        {text}
      </span>
    );
  }

  return (
    <motion.span
      className={`inline-block ${className}`}
      style={{ ...gradientStyle, backgroundPosition }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  );
};

export default ShinyText;
