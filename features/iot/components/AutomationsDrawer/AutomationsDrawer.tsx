"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { Clock, X, Info } from "@/components/ui/hugeicons";
import { Alert } from "@/components/reui/alert";
import { AutomationProvider } from "./context/AutomationContext";
import AutomationForm from "./components/AutomationForm";
import AutomationList from "./components/AutomationList";

interface AutomationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  animationsEnabled?: boolean;
}

export default function AutomationsDrawer({
  isOpen,
  onClose,
  isDark,
  animationsEnabled,
}: AutomationsDrawerProps) {
  const backdropBackground = isDark ? "rgba(9, 9, 11, 0.68)" : "rgba(24, 24, 27, 0.18)";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="automations-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ backdropFilter: "blur(16px)", background: backdropBackground }}
          className="fixed inset-0 z-50 cursor-pointer"
        />
      )}
      {isOpen && (
        <motion.div
          key="automations-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 24, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-full max-w-md bg-[var(--background)] border-l border-[var(--border)] rounded-l-xl shadow-2xl z-50 flex flex-col overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--card)] shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-[var(--muted)] text-[var(--muted-foreground)]">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-lg text-[var(--foreground)]">مدیریت اتوماسیون‌ها</h2>
            </div>
            <Button
              variant="ghost"
              type="button"
              onClick={onClose}
              aria-label="بستن مدیریت اتوماسیون‌ها"
              className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] p-6 space-y-6">
            {/* Info Box */}
            <Alert
              variant="info"
              className="!flex !items-start !gap-3 !rounded-xl !border-[var(--border)] !bg-[var(--muted)] !p-4 text-xs leading-relaxed text-[var(--muted-foreground)] shadow-none"
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                زمان‌بندی یا شرط دمایی مورد نظر را تعریف کنید تا دستورات در زمان مشخص‌شده به‌طور خودکار
                به تجهیزات ارسال شوند.
              </p>
            </Alert>

            <AutomationProvider>
              <AutomationForm />
              <AutomationList />
            </AutomationProvider>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
