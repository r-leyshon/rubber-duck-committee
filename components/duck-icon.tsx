import { cn } from '@/lib/utils'

interface DuckIconProps {
  className?: string
}

export function DuckIcon({ className }: DuckIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('h-6 w-6', className)}
    >
      {/* Simple rubber duck - side profile */}
      {/* Body */}
      <ellipse cx="10" cy="15" rx="7" ry="5" />
      {/* Head */}
      <circle cx="16" cy="9" r="4" />
      {/* Beak */}
      <path d="M19 9 L23 8.5 L23 10 L19 9.5 Z" />
      {/* Eye - cutout */}
      <circle cx="17.5" cy="8" r="1" className="fill-background" />
      {/* Wing detail */}
      <ellipse cx="9" cy="14" rx="3" ry="2" className="opacity-20 fill-background" />
    </svg>
  )
}
