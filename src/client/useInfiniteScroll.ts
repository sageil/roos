import { useEffect, useRef } from "react";

export const useInfiniteScroll = ({
  enabled,
  onLoadMore
}: {
  enabled: boolean;
  onLoadMore: () => void;
}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: "160px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, onLoadMore]);

  return sentinelRef;
};
