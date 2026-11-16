/** The two soft green glows behind every screen; the glass surfaces blur them. */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-28 top-40 h-80 w-80 rounded-full blur-[80px]" style={{ background: "var(--tl-blob-a)" }} />
      <div className="absolute -right-28 top-[28rem] h-96 w-96 rounded-full blur-[90px]" style={{ background: "var(--tl-blob-b)" }} />
    </div>
  );
}
