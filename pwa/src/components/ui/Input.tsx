import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'ghost'
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'default', error, type, ...props }, ref) => {
    const baseClasses = 'flex h-11 w-full rounded-xl px-4 py-2 text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

    const variants = {
      default: 'bg-zinc-900/50 border border-zinc-700 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
      ghost: 'bg-transparent border-0 border-b border-zinc-700 rounded-none focus:border-orange-500'
    }

    const errorClasses = error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : ''

    return (
      <input
        type={type}
        className={cn(
          baseClasses,
          variants[variant],
          errorClasses,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
