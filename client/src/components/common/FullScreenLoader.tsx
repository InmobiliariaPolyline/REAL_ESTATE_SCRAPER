import Logo from "./Logo"

export default function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-app">
      <div className="animate-fadeIn flex flex-col items-center gap-6" role="status">
        <Logo />
        <div className="relative size-10">
          <span className="absolute inset-0 rounded-full border-2 border-surface-4" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold" />
        </div>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-text-faint">
          {label}
        </span>
      </div>
    </div>
  )
}
