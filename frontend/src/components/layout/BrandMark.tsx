import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  size?: number;
  variant?: "dark" | "light";
  showWordmark?: boolean;
  className?: string;
};

export function BrandMark({
  href = "/",
  size = 36,
  variant = "dark",
  showWordmark = true,
  className = "",
}: BrandMarkProps) {
  const src = variant === "light" ? "/brand/logo-white.png" : "/brand/logo.png";
  const content = (
    <span className={["brand-mark", className].filter(Boolean).join(" ")}>
      <Image src={src} alt="" width={size} height={size} className="brand-mark-img" priority />
      {showWordmark ? <span className="brand-mark-text">RescueGrid</span> : null}
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} className="brand-mark-link" aria-label="RescueGrid home">
      {content}
    </Link>
  );
}
