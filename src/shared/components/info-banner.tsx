"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { useIsSpanish } from "@/shared/hooks/use-is-spanish";

interface InfoBannerProps {
  message: string;
  messageEn?: string;
}

export function InfoBanner({ message, messageEn }: InfoBannerProps) {
  const [visible, setVisible] = useState(true);
  const isSpanish = useIsSpanish();
  const text = messageEn && !isSpanish ? messageEn : message;

  if (!visible) return null;

  return (
    <div className="fixed top-3 left-3 right-3 z-50 bg-[#D4AF37] text-black flex items-center justify-between px-4 py-2.5 rounded-xl shadow-lg">
      <span className="text-sm font-medium flex-1 text-center">{text}</span>
      <button
        onClick={() => setVisible(false)}
        className="ml-3 shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Cerrar aviso"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
