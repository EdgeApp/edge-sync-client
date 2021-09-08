interface TtlCache<T> {
  get: () => T
}

export function makeTtlCache<T>(getter: () => T, ttl: number): TtlCache<T> {
  // End of life timestamp
  let eol = Date.now() + ttl
  // Cached value
  let cache: T = getter()

  return {
    get: () => {
      if (Date.now() > eol || cache == null) {
        eol = Date.now() + ttl
        cache = getter()
      }
      return cache
    }
  }
}
