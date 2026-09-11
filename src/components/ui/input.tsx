import * as React from 'react'
import { cn } from '@/src/lib/ui-utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn('ui-control ui-input', className)} {...props} />
}

export { Input }
