interface TtlCache<T> {
  get: () => T
}

export function makeTtlCache<T>(
  getter: (prev: T | undefined) => T,
  ttl: number
): TtlCache<T> {
  // End of life timestamp
  let eol = Date.now() + ttl
  // Cached value
  let cachedValue: T = getter(undefined)

  return {
    get: () => {
      if (Date.now() > eol || cachedValue == null) {
        eol = Date.now() + ttl
        const value = getter(cachedValue)
        cachedValue = value
      }
      return cachedValue
    }
  }
}
