"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalFrameProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function ModalFrame({ open, title, subtitle, onClose, children, wide }: ModalFrameProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-ink/70 p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className={cn("pixel-frame flex max-h-full w-full flex-col overflow-hidden", wide ? "max-w-5xl" : "max-w-3xl")}
            initial={{ scale: 0.97, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b-2 border-moss px-4 py-3">
              <div>
                <h2 className="font-pixel text-[12px] tracking-widest text-amber text-glow-amber sm:text-[13px]">{title}</h2>
                {subtitle && <p className="text-[14px] text-ash">{subtitle}</p>}
              </div>
              <button type="button" onClick={onClose} className="pixel-btn ml-auto px-2 py-0.5 text-[15px] text-parchment hover:bg-moss/70" aria-label="Close">
                ESC ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
