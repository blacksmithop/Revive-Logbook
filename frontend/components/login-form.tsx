"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { saveApiKey } from "@/lib/indexeddb"
import { ExternalLink } from "lucide-react"

interface LoginFormProps {
  onLogin: () => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [apiKey, setApiKey] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!apiKey.trim()) {
      setError("Please enter an API key")
      return
    }

    setIsLoading(true)
    try {
      // Test the API key with a simple request
      const response = await fetch(`https://api.torn.com/v2/user/revives?filters=outgoing&limit=1&striptags=true`, {
        headers: {
          accept: "application/json",
          Authorization: `ApiKey ${apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error("Invalid API key")
      }

      // Save the API key to IndexedDB
      await saveApiKey(apiKey)
      onLogin()
    } catch (err) {
      setError("Failed to authenticate. Please check your API key.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Revive Logbook</CardTitle>
            <CardDescription>Enter your Torn API key to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                />
                <a
                  href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=ReviveLogbook&torn=items&user=revives,log"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-white/90 hover:text-white font-semibold transition-colors"
                >
                  Create Custom API Key
                  <ExternalLink className="h-3 w-3" />
                </a>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Authenticating..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        Created by{" "}
        <a
          href="https://www.torn.com/profiles.php?XID=1712955"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/90 hover:text-white font-semibold transition-colors"
        >
          Oxiblurr [1712955]
        </a>
      </footer>
    </div>
  )
}
