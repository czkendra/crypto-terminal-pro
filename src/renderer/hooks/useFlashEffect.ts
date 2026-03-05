import { useRef, useEffect, useCallback } from 'react'

export function useFlashEffect(price: number): (el: HTMLElement | null) => void {
  const prevPriceRef = useRef<number>(price)
  const elRef = useRef<HTMLElement | null>(null)
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = prevPriceRef.current
    const el = elRef.current

    if (el && prev !== 0 && price !== prev) {
      // Remove existing flash classes
      el.classList.remove('flash-up', 'flash-down')
      // Force reflow to restart animation
      void el.offsetWidth
      // Add new flash class
      el.classList.add(price > prev ? 'flash-up' : 'flash-down')

      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current)
      animTimeoutRef.current = setTimeout(() => {
        el.classList.remove('flash-up', 'flash-down')
      }, 500)
    }

    prevPriceRef.current = price
  }, [price])

  const ref = useCallback((el: HTMLElement | null) => {
    elRef.current = el
  }, [])

  return ref
}
