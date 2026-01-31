import { Beer } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary">
              <Beer className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-gold-gradient">
              The Lounge Beerhouse
            </span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Eventos
            </Link>
            <Link href="/terminos" className="hover:text-primary transition-colors">
              Terminos
            </Link>
            <Link href="/privacidad" className="hover:text-primary transition-colors">
              Privacidad
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} The Lounge Beerhouse. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
