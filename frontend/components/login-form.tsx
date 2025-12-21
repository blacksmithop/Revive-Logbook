"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { saveApiKey } from "@/lib/indexeddb"

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Torn Revives Tracker</CardTitle>
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
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
