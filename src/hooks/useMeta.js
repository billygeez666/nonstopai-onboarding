import { useEffect } from 'react'

// Per-route document title + meta description (SPA-safe; no-op during SSR).
export default function useMeta(meta) {
  useEffect(() => {
    if (!meta) return
    if (meta.title) document.title = meta.title
    if (meta.description) {
      let el = document.querySelector('meta[name="description"]')
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', 'description')
        document.head.appendChild(el)
      }
      el.setAttribute('content', meta.description)
    }
  }, [meta])
}
