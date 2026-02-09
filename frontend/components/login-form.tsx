"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { saveApiKey, saveApiMode } from "@/lib/indexeddb"
import { ExternalLink, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface LoginFormProps {
  onLogin: () => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [apiKey, setApiKey] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"user" | "faction">("user")
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!apiKey.trim()) {
      setError("Please enter an API key")
      return
    }

    setIsLoading(true)
    try {
      const endpoint =
        mode === "user"
          ? "https://api.torn.com/v2/user/revives?filters=outgoing&limit=1&striptags=true"
          : "https://api.torn.com/v2/faction/revives?filters=outgoing&limit=1&sort=DESC&striptags=true"

      const response = await fetch(endpoint, {
        headers: {
          accept: "application/json",
          Authorization: `ApiKey ${apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error("Invalid API key")
      }

      await saveApiKey(apiKey)
      await saveApiMode(mode)
      toast({
        title: "Logged in",
        description: `Authenticated as ${mode === "user" ? "User" : "Faction"} successfully.`,
      })
      onLogin()
    } catch (err) {
      setError("Failed to authenticate. Please check your API key.")
    } finally {
      setIsLoading(false)
    }
  }

  const apiKeyUrl =
    mode === "user"
      ? "https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=ReviveLogbook&torn=items&user=revives,log"
      : "https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=FactionReviveTracker&faction=revives"

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
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => setMode("user")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    mode === "user"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setMode("faction")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    mode === "faction"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Faction
                </button>
              </div>

              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                />
                <div className="text-center">
                  <a
                    href={apiKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white font-semibold transition-colors"
                  >
                    Create Custom API Key {mode === "faction" ? "(Faction)" : ""}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-6 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-white/70" />
                  <div className="space-y-1.5 text-sm text-white/90 leading-relaxed">
                    <p>• Your API Key is stored in the browser</p>
                    <p>• All requests are made in the browser itself</p>
                    <p>• Logout anytime to clear your data & API Key</p>
                    <p>
                      •{" "}
                      <a
                        href="https://www.torn.com/forums.php#/p=threads&f=67&t=16527395&b=0&a=0"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/90 hover:text-white font-semibold underline underline-offset-2 transition-colors"
                      >
                        Please share any feedback here
                      </a>
                    </p>
                  </div>
                </div>
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
