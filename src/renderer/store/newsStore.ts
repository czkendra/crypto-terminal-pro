import { create } from 'zustand'
import { NewsItem, NewsFilter } from './types'

interface TrendingTopic {
  word: string
  count: number
  sentiment: 'bullish' | 'bearish' | 'neutral'
}

interface NewsState {
  items: NewsItem[]
  filter: NewsFilter
  searchQuery: string
  lastUpdated: number | null
  newItemCount: number          // # items added since user last cleared
  trendingTopics: TrendingTopic[]
  isLoading: boolean

  setItems: (items: NewsItem[]) => void
  addItems: (items: NewsItem[]) => void
  setFilter: (f: NewsFilter) => void
  setSearchQuery: (q: string) => void
  setLastUpdated: (ts: number) => void
  setNewItemCount: (n: number) => void
  clearNewItemCount: () => void
  setTrendingTopics: (topics: TrendingTopic[]) => void
  setIsLoading: (v: boolean) => void
  filteredItems: () => NewsItem[]
}

export const useNewsStore = create<NewsState>((set, get) => ({
  items: [],
  filter: 'all',
  searchQuery: '',
  lastUpdated: null,
  newItemCount: 0,
  trendingTopics: [],
  isLoading: false,

  setItems: (items) => set({ items }),

  addItems: (items) =>
    set((state) => {
      const existingIds = new Set(state.items.map((i) => i.id))
      const newOnes = items.filter((i) => !existingIds.has(i.id))
      if (newOnes.length === 0) return {}
      const merged = [...newOnes, ...state.items].slice(0, 300)
      return { items: merged, newItemCount: state.newItemCount + newOnes.length }
    }),

  setFilter: (f) => set({ filter: f }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setLastUpdated: (ts) => set({ lastUpdated: ts }),
  setNewItemCount: (n) => set({ newItemCount: n }),
  clearNewItemCount: () => set({ newItemCount: 0 }),
  setTrendingTopics: (topics) => set({ trendingTopics: topics }),
  setIsLoading: (v) => set({ isLoading: v }),

  filteredItems: () => {
    const { items, filter, searchQuery } = get()
    let result = items
    if (filter !== 'all') result = result.filter((i) => i.sentiment === filter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (i) => i.title.toLowerCase().includes(q) || i.source.toLowerCase().includes(q)
      )
    }
    return result
  }
}))
