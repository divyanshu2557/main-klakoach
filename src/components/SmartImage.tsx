import { type ImgHTMLAttributes, useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";

type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src?: string | null;
  alt: string;
  fallbackSrc?: string | null;
  fallbackLabel?: string;
};

function getInitials(value: string) {
  const words = value
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join("") || "K";
}

export function SmartImage({ src, alt, className, fallbackSrc, fallbackLabel, onError, onLoad, ...props }: SmartImageProps) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const candidates = useMemo(() => {
    const urls = [src, fallbackSrc].map((url) => url?.trim()).filter((url): url is string => Boolean(url));
    return [...new Set(urls)];
  }, [fallbackSrc, src]);

  const displaySrc = candidates.find((url) => !failedUrls.includes(url));
  const label = useMemo(() => fallbackLabel ?? getInitials(alt), [alt, fallbackLabel]);

  useEffect(() => {
    setFailedUrls([]);
    setLoaded(false);
  }, [candidates]);

  if (!displaySrc) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "relative isolate grid place-items-center overflow-hidden bg-[#201a14] text-[#f4ead9]",
          className,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(212,168,67,0.32),transparent_28%),radial-gradient(circle_at_78%_68%,rgba(12,90,78,0.28),transparent_30%),linear-gradient(135deg,#211713,#3f3325_48%,#142f2c)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/45 to-transparent" />
        <span className="relative rounded-full border border-white/20 bg-black/20 px-3 py-2 text-xs font-semibold tracking-[0.22em] shadow-2xl backdrop-blur">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Shimmer placeholder shown until image loads */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#2a2218] via-[#332b1f] to-[#2a2218]" />
      )}
      <img
        {...props}
        src={displaySrc}
        alt={alt}
        className={cn(
          "h-full w-full bg-[#e8e0d5] transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
        loading={props.loading ?? "lazy"}
        decoding={props.decoding ?? "async"}
        referrerPolicy={props.referrerPolicy ?? "no-referrer"}
        onLoad={(event) => {
          setLoaded(true);
          onLoad?.(event);
        }}
        onError={(event) => {
          onError?.(event);
          setFailedUrls((current) => (current.includes(displaySrc) ? current : [...current, displaySrc]));
        }}
      />
    </div>
  );
}
