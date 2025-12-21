"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RevivesTable } from "./revives-table"
import { enrichRevives, type EnrichedRevive } from "@/lib/revive-enrichment"
import { getApiKey, saveRevives, getAllRevives, getOldestTimestamp, clearApiKey, clearAllData } from "@/lib/indexeddb"
import { Loader2, RefreshCw, LogOut, ChevronDown } from "lucide-react"

interface RevivesDashboardProps {
  onLogout: () => void
}

export function RevivesDashboard({ onLogout }: RevivesDashboardProps) {
  const [revives, setRevives] = useState<EnrichedRevive[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [userReviveId, setUserReviveId] = useState<number>(0)

  const fetchRevives = async (backfill = false) => {
    if (backfill) {
      setIsLoadingMore(true)
    } else {
      setIsFetching(true)
    }
    setError("")

    try {
      const apiKey = await getApiKey()
      if (!apiKey) {
        onLogout()
        return
      }

      let url = "https://api.torn.com/v2/user/revives?filters=outgoing&limit=100&striptags=true"

      // For backfill, get oldest timestamp and add it as `to` parameter
      if (backfill) {
        const oldestTimestamp = await getOldestTimestamp()
        if (oldestTimestamp) {
          url += `&to=${oldestTimestamp}`
        }
      }

      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          Authorization: `ApiKey ${apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch revives")
      }

      const data = await response.json()
      const fetchedRevives = data.revives || []

      if (fetchedRevives.length > 0) {
        // Get user's revive ID from first revive
        if (!userReviveId && fetchedRevives[0]?.reviver?.id) {
          setUserReviveId(fetchedRevives[0].reviver.id)
        }

        // Save to IndexedDB
        await saveRevives(fetchedRevives)

        // Load all revives from IndexedDB and enrich
        const allRevives = await getAllRevives()
        const enriched = enrichRevives(allRevives, fetchedRevives[0]?.reviver?.id || userReviveId)
        setRevives(enriched)
      }
    } catch (err) {
      setError("Failed to fetch revives. Please try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
      setIsFetching(false)
      setIsLoadingMore(false)
    }
  }

  const loadFromCache = async () => {
    try {
      const cachedRevives = await getAllRevives()
      if (cachedRevives.length > 0) {
        const enriched = enrichRevives(cachedRevives, cachedRevives[0]?.reviver?.id || 0)
        setRevives(enriched)
        if (cachedRevives[0]?.reviver?.id) {
          setUserReviveId(cachedRevives[0].reviver.id)
        }
      }
    } catch (err) {
      console.error("Failed to load cached revives:", err)
    }
  }

  useEffect(() => {
    // Load cached data first, then fetch fresh data
    loadFromCache().then(() => fetchRevives())
  }, [])

  const handleRefresh = () => {
    fetchRevives(false)
  }

  const handleLoadMore = () => {
    fetchRevives(true)
  }

  const handleClearApiKey = async () => {
    try {
      await clearApiKey()
      onLogout()
    } catch (err) {
      console.error("Failed to clear API key:", err)
    }
  }

  const handleClearAllData = async () => {
    if (confirm("Are you sure you want to clear all data? This will remove your API key and all cached revives.")) {
      try {
        await clearAllData()
        onLogout()
      } catch (err) {
        console.error("Failed to clear all data:", err)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl sm:text-2xl">Torn Revives Tracker</CardTitle>
                <CardDescription className="text-sm">Tracking {revives.length} revives</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore || isFetching}
                  className="flex-1 sm:flex-initial bg-transparent"
                >
                  {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load More"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isFetching || isLoadingMore}
                  className="px-3 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-3 bg-transparent">
                      <LogOut className="w-4 h-4 mr-1" />
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleClearApiKey}>Clear API Key & Logout</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleClearAllData} className="text-destructive">
                      Clear All Data
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : revives.length > 0 ? (
              <RevivesTable revives={revives} onLoadMore={handleLoadMore} isLoadingMore={isLoadingMore} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">No revives found</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
