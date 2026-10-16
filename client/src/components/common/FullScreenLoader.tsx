export default function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex h-screen w-screen bg-black items-center justify-center">
      <div className="flex flex-col items-center gap-4" role="status">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#C9A96E]"></div>
        <span
          className="text-sm font-medium tracking-wider text-[#F0EDE8]/60 uppercase"
          style={{ fontFamily: "DM Sans" }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
