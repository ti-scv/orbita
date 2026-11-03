export default function BrandLogo({ small = false, wordmark = false }: { small?: boolean; wordmark?: boolean }) {
  const size = wordmark ? 156 : small ? 14 : 31;
  return (
    <img
      className={`brand-image${small ? " brand-image-small" : ""}${wordmark ? " brand-image-wordmark" : ""}`}
      src={wordmark ? "/logo.png?v=5ea30d48dcd0" : "/brand-envelope.png?v=fe94463a5107"}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      decoding="async"
    />
  );
}
