import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { cn } from "../../utils";

export function Modal({ open, onClose, title, children, className, testId = "modal" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-testid={`${testId}-overlay`}
        >
          <motion.div
            className={cn("card w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-0", className)}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            data-testid={testId}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-lg font-bold text-ink">{title}</h3>
              <button onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-muted" aria-label="Close" data-testid={`${testId}-close`}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
