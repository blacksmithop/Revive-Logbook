"use client"

import { useState, useEffect } from "react"
import { LoginForm } from "@/components/login-form"
import { RevivesDashboard } from "@/components/revives-dashboard"
import { getApiKey, initDB } from "@/lib/indexeddb"

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Initialize DB and check for existing API key
    const checkAuth = async () => {
      try {
        await initDB()
        const apiKey = await getApiKey()
        setIsAuthenticated(!!apiKey)
      } catch (err) {
        console.error("Failed to check authentication:", err)
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
  }

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="dark">
      {isAuthenticated ? <RevivesDashboard onLogout={handleLogout} /> : <LoginForm onLogin={handleLogin} />}
    </div>
  )
}
