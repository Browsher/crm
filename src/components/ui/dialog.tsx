'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/src/lib/ui-utils'

type Theme = 'light' | 'dark' | 'system'

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}
function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}
function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  theme?: Theme
  showCloseButton?: boolean
}

function DialogContent({ className, children, theme = 'system', showCloseButton = true, ...props }: DialogContentProps) {
  return <DialogPrimitive.Portal>
    <div className="crm-ui ui-dialog-portal" data-theme={theme}>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className="ui-dialog-overlay" />
      <DialogPrimitive.Content data-slot="dialog-content" className={cn('ui-dialog-content', className)} {...props}>
        {children}
        {showCloseButton && <DialogPrimitive.Close className="ui-dialog-close" aria-label="Fechar">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </DialogPrimitive.Close>}
      </DialogPrimitive.Content>
    </div>
  </DialogPrimitive.Portal>
}
function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('ui-dialog-header', className)} {...props} />
}
function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('ui-dialog-footer', className)} {...props} />
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn('ui-dialog-title', className)} {...props} />
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn('ui-dialog-description', className)} {...props} />
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
