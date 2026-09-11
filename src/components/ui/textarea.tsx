import * as React from 'react'
import { cn } from '@/src/lib/ui-utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn('ui-control ui-textarea', className)} {...props} />
}

export { Textarea }
