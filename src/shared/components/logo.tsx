import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: { container: "w-12 h-12", pixels: 48 },
  md: { container: "w-16 h-16", pixels: 64 },
  lg: { container: "w-20 h-20", pixels: 80 },
};

export function Logo({ size = "md", className }: LogoProps) {
  const { container, pixels } = sizeClasses[size];

  return (
    <div className={cn("relative", container, className)}>
      <Image
        src="/images/logo.png"
        alt="The Lounge Beerhouse"
        width={pixels}
        height={pixels}
        className="rounded-full"
        priority
      />
    </div>
  );
}
