"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ButtonPixelProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "default" | "amber" | "ember" | "river" | "violet";
  size?: "sm" | "md";
  children: ReactNode;
}

const TONE: Record<NonNullable<ButtonPixelProps["tone"]>, string> = {
  default: "text-parchment hover:text-bone",
  amber: "text-amber hover:text-amber-2",
  ember: "text-[#ff8f8b] hover:text-[#ffb3b0]",
  river: "text-[#8ec2ee] hover:text-[#b6dbff]",
  violet: "text-[#c3adf5] hover:text-[#dccdfb]",
};

export function ButtonPixel({ active, tone = "default", size = "md", className, children, ...rest }: ButtonPixelProps) {
  return (
    <button
      type="button"
      className={cn(
        "pixel-btn font-terminal select-none whitespace-nowrap uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[15px]" : "px-3 py-1 text-[17px]",
        TONE[tone],
        active && "pixel-btn-pressed bg-moss text-bone",
        "hover:bg-moss/70 active:pixel-btn-pressed disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
