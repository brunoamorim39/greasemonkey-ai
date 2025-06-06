import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  size = 'md',
  className
}: ToggleProps) {
  const sizes = {
    sm: {
      box: 'h-4 w-4',
      icon: 'h-3 w-3'
    },
    md: {
      box: 'h-5 w-5',
      icon: 'h-4 w-4'
    },
    lg: {
      box: 'h-6 w-6',
      icon: 'h-5 w-5'
    }
  }

  const sizeConfig = sizes[size]

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        // Base styles
        'relative inline-flex items-center justify-center rounded-md border-2 transition-all duration-200 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:ring-offset-2 focus:ring-offset-zinc-900',

        // Size
        sizeConfig.box,

        // States
        checked
          ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-500 shadow-lg shadow-orange-500/25'
          : 'bg-transparent border-zinc-500 hover:border-zinc-400',

        // Disabled state
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:scale-105',

        className
      )}
    >
      {checked && (
        <Check
          className={cn(
            'text-white transition-all duration-200',
            sizeConfig.icon
          )}
          strokeWidth={3}
        />
      )}
    </button>
  )
}
