"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/45 p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-[var(--shadow-lift)] sm:rounded-2xl",
              wide ? "sm:max-w-3xl" : "sm:max-w-lg"
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
                  {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-canvas-2 hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            )}
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
