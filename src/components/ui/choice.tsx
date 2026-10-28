import type { ComponentProps, ReactElement } from 'react'
import { cn } from '@/src/lib/ui-utils'

type Props = Omit<ComponentProps<'input'>, 'type'> & { type: 'checkbox' | 'radio' }

export function Choice({ className, ...props }: Props): ReactElement {
  return <input data-slot="choice" className={cn(
    'size-[18px] shrink-0 cursor-pointer accent-primary focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60',
    className,
  )} {...props} />
}
