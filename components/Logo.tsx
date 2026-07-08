export function Logo({ size = 44 }: { size?: number }) {
  const inner = Math.round(size * 0.52);
  return (
    <span className="logo-mark" style={{ width: size, height: size, fontSize: inner }} aria-label="Routsify">
      ✦
    </span>
  );
}
