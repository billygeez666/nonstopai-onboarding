export default function Footer() {
  return (
    <footer className="border-t border-ink-line/70 mt-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-paper-faint">
        <span className="flex items-center gap-2">
          <img src="/nonstop-mark.png" alt="" width="96" height="78" className="h-5 w-auto" />
          <img src="/nonstop-wordmark.png" alt="NONSTOP AI" width="180" height="26" className="h-[11px] w-auto" />
          <span className="font-mono text-xs tracking-wide">· UK</span>
        </span>
        <p>Built for businesses that never want to miss another customer.</p>
      </div>
    </footer>
  )
}
