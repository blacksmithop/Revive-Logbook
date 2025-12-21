// IndexedDB utilities for storing API key and revives data
const DB_NAME = "TornRevivesDB"
const DB_VERSION = 2 // Increment version for payment status store
const SETTINGS_STORE = "settings"
const REVIVES_STORE = "revives"
const PAYMENT_STATUS_STORE = "paymentStatus" // New store for payment status

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

      // Revives store with timestamp index
      if (!db.objectStoreNames.contains(REVIVES_STORE)) {
        const revivesStore = db.createObjectStore(REVIVES_STORE, { keyPath: "id" })
        revivesStore.createIndex("timestamp", "timestamp", { unique: false })
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

export async function saveRevives(revives: any[]): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([REVIVES_STORE], "readwrite")
    const store = transaction.objectStore(REVIVES_STORE)

    // Add all revives
    revives.forEach((revive) => {
      store.put(revive)
    })

    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => resolve()
  })
}

export async function getAllRevives(): Promise<any[]> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([REVIVES_STORE], "readonly")
    const store = transaction.objectStore(REVIVES_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function getOldestTimestamp(): Promise<number | null> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([REVIVES_STORE], "readonly")
    const store = transaction.objectStore(REVIVES_STORE)
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

export async function savePaymentStatus(timestamp: number, targetId: number, isPaid: boolean): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENT_STATUS_STORE], "readwrite")
    const store = transaction.objectStore(PAYMENT_STATUS_STORE)
    const id = `${timestamp}_${targetId}`
    const request = store.put({ id, timestamp, targetId, isPaid })

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getPaymentStatus(timestamp: number, targetId: number): Promise<boolean | null> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENT_STATUS_STORE], "readonly")
    const store = transaction.objectStore(PAYMENT_STATUS_STORE)
    const id = `${timestamp}_${targetId}`
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result
      resolve(result ? result.isPaid : null)
    }
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

export async function getPaymentStatusById(id: string): Promise<boolean | null> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENT_STATUS_STORE], "readonly")
    const store = transaction.objectStore(PAYMENT_STATUS_STORE)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result
      resolve(result ? result.isPaid : null)
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
    const transaction = db.transaction([SETTINGS_STORE, REVIVES_STORE, PAYMENT_STATUS_STORE], "readwrite")

    const settingsStore = transaction.objectStore(SETTINGS_STORE)
    const revivesStore = transaction.objectStore(REVIVES_STORE)
    const paymentStore = transaction.objectStore(PAYMENT_STATUS_STORE)

    settingsStore.clear()
    revivesStore.clear()
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
