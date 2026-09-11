import * as React from 'react'
import { cn } from '@/src/lib/ui-utils'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label data-slot="label" className={cn('ui-label', className)} {...props} />
}

export { Label }
