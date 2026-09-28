"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";

import type { AdminRole } from "@/modules/auth/types";

/**
 * Piezas del formulario de usuarios, con el mismo estilo que el de eventos
 * (`eventos/[id]/client.tsx`): mismo input, mismas etiquetas, mismos botones de opción
 * dorados y mismo recuadro de error.
 */
export const INPUT_CLASS =
  "w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37] placeholder:text-white/30 disabled:opacity-60";

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-white/70 text-xs font-medium">
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

/**
 * Una pista bajo un campo: gris mientras no se cumple, verde cuando sí, y roja con
 * `bad`, cuando ya se ve que está mal (la repetición no coincide).
 */
export function Hint({
  ok,
  bad,
  children,
}: {
  ok: boolean;
  bad?: boolean;
  children: React.ReactNode;
}) {
  const tone = ok ? "text-green-400" : bad ? "text-red-400" : "text-white/40";
  return (
    <p className={`flex items-center gap-1 text-xs ${tone}`}>
      {ok && <Check className="w-3 h-3" aria-hidden="true" />}
      {children}
    </p>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  testId,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  placeholder?: string;
  testId?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        data-testid={testId}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`${INPUT_CLASS} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

const ROLES: { value: AdminRole; label: string; description: string }[] = [
  { value: "WORKER", label: "Worker", description: "Reservas y bloqueo de asientos" },
  { value: "ADMIN", label: "Admin", description: "Todo el panel, usuarios incluidos" },
];

export function RoleSelector({
  value,
  onChange,
  disabled,
}: {
  value: AdminRole;
  onChange: (role: AdminRole) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Rol">
      {ROLES.map((role) => (
        <button
          key={role.value}
          type="button"
          role="radio"
          aria-checked={value === role.value}
          data-testid={`user-role-${role.value}`}
          disabled={disabled}
          onClick={() => onChange(role.value)}
          className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
            value === role.value
              ? "bg-[#92700c] border-[#D4AF37] text-white"
              : "bg-transparent border-white/20 text-white/50"
          }`}
        >
          <span className="block text-sm font-semibold">{role.label}</span>
          <span className="block text-[11px] opacity-80">{role.description}</span>
        </button>
      ))}
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      data-testid="user-error"
      className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
    >
      <p className="text-red-400 text-sm">{children}</p>
    </div>
  );
}
