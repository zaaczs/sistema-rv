import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
  textClassName?: string;
};

export function BrandLogo({
  className,
  iconClassName = "h-8 w-8",
  showText = true,
  textClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/logorv.jpg"
        alt="Reville Fitness"
        width={32}
        height={32}
        className={cn("shrink-0 rounded-full object-cover", iconClassName)}
        priority
      />
      {showText && (
        <span className={cn("truncate font-semibold", textClassName)}>Reville Fitness</span>
      )}
    </div>
  );
}
