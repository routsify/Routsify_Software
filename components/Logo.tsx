export function Logo({ size = 44, src, alt = "Routsify" }: { size?: number; src?: string | null; alt?: string }) {
  const inner = Math.round(size * 0.52);
  return (
    <span className={`logo-mark ${src ? "has-image" : ""}`} style={{ width: size, height: size, fontSize: inner }} aria-label={alt}>
      {src ? <Image src={src} alt={alt} width={size} height={size} /> : "✦"}
    </span>
  );
}
import Image from "next/image";
