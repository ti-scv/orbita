export default function BrandLogo({ small = false, wordmark = false, communication = false }: { small?: boolean; wordmark?: boolean; communication?: boolean }) {
  const size = wordmark ? 156 : small ? 16 : communication ? 40 : 31;
  return (
    <img
      className={`brand-image${small ? " brand-image-small" : ""}${communication ? " brand-image-communication" : ""}${wordmark ? " brand-image-wordmark" : ""}`}
      src={communication ? "/scv-communication-icon.png?v=1ae32852f0ce" : wordmark ? "/logo.png?v=5ea30d48dcd0" : "/brand-envelope.png?v=fe94463a5107"}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      decoding="async"
    />
  );
}
