import { useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

export function useQueryParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /**
   * Set multiple query parameters at once.
   * If a value is null, undefined, or an empty string, the parameter is removed.
   */
  const setQueryParams = useCallback(
    (
      params: Record<string, string | null | undefined>,
      options?: { replace?: boolean; scroll?: boolean }
    ) => {
      // Create a new URLSearchParams object from the current search params
      const current = new URLSearchParams(Array.from(searchParams.entries()))

      // Update or delete parameters
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === "") {
          current.delete(key)
        } else {
          current.set(key, value)
        }
      }

      const search = current.toString()
      const query = search ? `?${search}` : ""
      const url = `${pathname}${query}`

      // Push or replace the URL
      if (options?.replace) {
        router.replace(url, { scroll: options?.scroll ?? false })
      } else {
        router.push(url, { scroll: options?.scroll ?? false })
      }
    },
    [pathname, router, searchParams]
  )

  /**
   * Convenience method to set a single query parameter.
   */
  const setQueryParam = useCallback(
    (
      name: string,
      value: string | null | undefined,
      options?: { replace?: boolean; scroll?: boolean }
    ) => {
      setQueryParams({ [name]: value }, options)
    },
    [setQueryParams]
  )

  return {
    searchParams,
    setQueryParams,
    setQueryParam,
  }
}
