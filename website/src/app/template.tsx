/**
 * A remount boundary, and nothing more.
 *
 * Next keys this per navigation, which is what makes the page entrance replay when
 * you move between two routes of the same segment (/places/a to /places/b) where
 * React would otherwise reconcile in place and never restart the animation.
 *
 * The entrance itself is not here. This wraps the Suspense boundary, so it mounts
 * with the loading screen: an animation on this element plays over the loader and is
 * finished by the time the real content swaps in, landing the page as a hard cut.
 * `.page-in` lives on each page's <main> instead, where it mounts with the content.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
