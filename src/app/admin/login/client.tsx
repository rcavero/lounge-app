"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { login } from "@/modules/auth/actions";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-white/70 text-xs font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@example.com"
          className="w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37] placeholder:text-white/30"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-white/70 text-xs font-medium">
          Contrasena
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37] placeholder:text-white/30"
        />
      </div>

      {state?.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{state.error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold py-3"
      >
        <LogIn className="w-4 h-4 mr-2" />
        {isPending ? "Iniciando sesion..." : "Iniciar sesion"}
      </Button>
    </form>
  );
}
