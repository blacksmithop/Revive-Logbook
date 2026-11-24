"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
      <AlertTriangle className="w-8 h-8 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-balance">Something went wrong</h2>
        <p className="text-sm text-muted-foreground text-balance">Your data is stored locally and has not been lost.</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
