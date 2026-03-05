import { useEffect, useRef } from 'react'
import { useNewsStore } from '../store/newsStore'
import { fetchNews, extractTrendingTopics } from '../services/newsService'

const REFRESH_INTERVAL = 90 * 1000  // 90 seconds — live feel

export function useNews(): void {
  const setItems         = useNewsStore((s) => s.setItems)
  const addItems         = useNewsStore((s) => s.addItems)
  const setLastUpdated   = useNewsStore((s) => s.setLastUpdated)
  const setTrendingTopics = useNewsStore((s) => s.setTrendingTopics)
  const setIsLoading     = useNewsStore((s) => s.setIsLoading)
  const initialLoad      = useRef(false)

  useEffect(() => {
    async function load(isFirst: boolean) {
      if (isFirst) setIsLoading(true)
      try {
        const items = await fetchNews()
        if (items.length === 0) return
        if (isFirst) {
          setItems(items)
        } else {
          addItems(items)
        }
        setLastUpdated(Date.now())
        // Recompute trending topics after every load
        const topics = extractTrendingTopics(items)
        setTrendingTopics(topics)
      } catch (e) {
        console.warn('[useNews] fetch error:', e)
      } finally {
        if (isFirst) setIsLoading(false)
      }
    }

    if (!initialLoad.current) {
      initialLoad.current = true
      load(true)
    }

    const interval = setInterval(() => load(false), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [setItems, addItems, setLastUpdated, setTrendingTopics, setIsLoading])
}
