'use client'

interface ConfirmSubmitButtonProps {
  message: string
  className?: string
  children: React.ReactNode
}

export function ConfirmSubmitButton({ message, className, children }: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
