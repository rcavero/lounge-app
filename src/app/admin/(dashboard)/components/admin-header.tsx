"use client";

import { Button } from "@/components/ui/button";
import { logout } from "@/modules/auth/actions";
import { LogOut } from "lucide-react";

interface AdminHeaderProps {
  email: string;
}

export function AdminHeader({ email }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-white text-sm font-semibold">Admin Panel</p>
          <p className="text-white/50 text-xs">{email}</p>
        </div>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-1" />
            Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
