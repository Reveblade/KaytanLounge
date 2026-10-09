import type { ReactNode } from "react";

export default function BakeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body { overflow: hidden; }
        [data-music-player], .loading-screen, nextjs-portal, [data-next-badge-root] { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
