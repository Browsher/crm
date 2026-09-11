import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/src/lib/ui-utils'

const badgeVariants = cva('ui-badge', {
  variants: {
    variant: {
      default: 'ui-badge--default',
      success: 'ui-badge--success',
      warning: 'ui-badge--warning',
      danger: 'ui-badge--danger',
      outline: 'ui-badge--outline',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
