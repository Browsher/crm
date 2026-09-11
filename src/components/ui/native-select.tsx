import * as React from 'react'
import { cn } from '@/src/lib/ui-utils'

function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return <select data-slot="native-select" className={cn('ui-control ui-native-select', className)} {...props}>{children}</select>
}

export { NativeSelect }
