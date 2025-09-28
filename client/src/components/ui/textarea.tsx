import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[160px] w-full rounded-md border border-border bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus:outline-none focus:border-border hover:border-border disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
