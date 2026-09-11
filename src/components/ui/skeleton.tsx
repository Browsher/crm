import * as React from 'react'
import { cn } from '@/src/lib/ui-utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('ui-skeleton', className)} {...props} />
}

export { Skeleton }
