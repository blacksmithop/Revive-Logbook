// IndexedDB utilities for storing API key and revives data
const DB_NAME = "TornRevivesDB"
const DB_VERSION = 3
const SETTINGS_STORE = "settings"
const USER_REVIVES_STORE = "userRevives"
const FACTION_REVIVES_STORE = "factionRevives"
const PAYMENT_STATUS_STORE = "paymentStatus"

let dbInstance: IDBDatabase | null = null

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Settings store for API key
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE)
      }

      if (!db.objectStoreNames.contains(USER_REVIVES_STORE)) {
        const userRevivesStore = db.createObjectStore(USER_REVIVES_STORE, { keyPath: "id" })
        userRevivesStore.createIndex("timestamp", "timestamp", { unique: false })
      }

      if (!db.objectStoreNames.contains(FACTION_REVIVES_STORE)) {
        const factionRevivesStore = db.createObjectStore(FACTION_REVIVES_STORE, { keyPath: "id" })
        factionRevivesStore.createIndex("timestamp", "timestamp", { unique: false })
      }

      if (db.objectStoreNames.contains("revives")) {
        db.deleteObjectStore("revives")
      }

      if (!db.objectStoreNames.contains(PAYMENT_STATUS_STORE)) {
        db.createObjectStore(PAYMENT_STATUS_STORE, { keyPath: "id" })
      }
    }
  })
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readwrite")
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.put(apiKey, "apiKey")

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getApiKey(): Promise<string | null> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readonly")
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.get("apiKey")

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

export async function saveRevives(revives: any[], mode: "user" | "faction" = "user"): Promise<void> {
  const db = await initDB()
  const storeName = mode === "user" ? USER_REVIVES_STORE : FACTION_REVIVES_STORE

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)

    // Add all revives
    revives.forEach((revive) => {
      store.put(revive)
    })

    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve()
  })
}

export async function getAllRevives(mode: "user" | "faction" = "user"): Promise<any[]> {
  const db = await initDB()
  const storeName = mode === "user" ? USER_REVIVES_STORE : FACTION_REVIVES_STORE

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly")
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function getOldestTimestamp(mode: "user" | "faction" = "user"): Promise<number | null> {
  const db = await initDB()
  const storeName = mode === "user" ? USER_REVIVES_STORE : FACTION_REVIVES_STORE

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly")
    const store = transaction.objectStore(storeName)
    const index = store.index("timestamp")
    const request = index.openCursor(null, "next")

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        resolve(cursor.value.timestamp)
      } else {
        resolve(null)
      }
    }
  })
}

export async function clearApiKey(): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readwrite")
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.delete("apiKey")

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function setPaymentStatus(id: string, isPaid: boolean): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENT_STATUS_STORE], "readwrite")
    const store = transaction.objectStore(PAYMENT_STATUS_STORE)
    const request = store.put({ id, isPaid })

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getPaymentStatus(id: string): Promise<boolean> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENT_STATUS_STORE], "readonly")
    const store = transaction.objectStore(PAYMENT_STATUS_STORE)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result
      resolve(result ? result.isPaid : false)
    }
  })
}

export async function getAllPaymentStatuses(): Promise<Record<string, boolean>> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENT_STATUS_STORE], "readonly")
    const store = transaction.objectStore(PAYMENT_STATUS_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const results = request.result || []
      const statuses: Record<string, boolean> = {}
      results.forEach((item: any) => {
        statuses[item.id] = item.isPaid
      })
      resolve(statuses)
    }
  })
}

export async function clearAllData(): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [SETTINGS_STORE, USER_REVIVES_STORE, FACTION_REVIVES_STORE, PAYMENT_STATUS_STORE],
      "readwrite",
    )

    const settingsStore = transaction.objectStore(SETTINGS_STORE)
    const userRevivesStore = transaction.objectStore(USER_REVIVES_STORE)
    const factionRevivesStore = transaction.objectStore(FACTION_REVIVES_STORE)
    const paymentStore = transaction.objectStore(PAYMENT_STATUS_STORE)

    settingsStore.clear()
    userRevivesStore.clear()
    factionRevivesStore.clear()
    paymentStore.clear()

    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve()
  })
}

export async function saveExcludedFilters(excludedPlayers: string[], excludedFactions: string[]): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readwrite")
    const store = transaction.objectStore(SETTINGS_STORE)
    store.put({ players: excludedPlayers, factions: excludedFactions }, "excludedFilters")

    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve()
  })
}

export async function getExcludedFilters(): Promise<{
  players: string[]
  factions: string[]
} | null> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readonly")
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.get("excludedFilters")

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

export async function saveApiMode(mode: "user" | "faction"): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readwrite")
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.put(mode, "apiMode")

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getApiMode(): Promise<"user" | "faction"> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readonly")
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.get("apiMode")

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || "user")
  })
}
