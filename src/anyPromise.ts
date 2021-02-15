/**
 * Waits for the first successful promise.
 * If no promise succeeds, returns the last failure.
 */
export async function anyPromise<T>(promises: Array<Promise<T>>): Promise<T> {
  return await new Promise((resolve, reject) => {
    let failed = 0
    for (const promise of promises) {
      promise.then(resolve, error => {
        if (++failed >= promises.length) reject(error)
      })
    }
  })
}
