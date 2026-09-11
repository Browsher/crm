import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/src/lib/ui-utils'

const buttonVariants = cva('ui-button', {
  variants: {
    variant: {
      default: 'ui-button--default',
      outline: 'ui-button--outline',
      ghost: 'ui-button--ghost',
      destructive: 'ui-button--destructive',
    },
    size: {
      default: 'ui-button--size-default',
      sm: 'ui-button--size-sm',
      icon: 'ui-button--size-icon',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
