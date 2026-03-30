"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface InfoBannerProps {
  message: string;
  messageEn?: string;
}

export function InfoBanner({ message, messageEn }: InfoBannerProps) {
  const [visible, setVisible] = useState(true);
  const [text, setText] = useState(message);

  useEffect(() => {
    if (messageEn && !navigator.language.startsWith("es")) {
      setText(messageEn);
    }
  }, [message, messageEn]);

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
