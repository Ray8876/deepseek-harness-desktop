import type { CNode } from 'css-render'
import { useEffect, useRef } from 'react'
import { mountStyle } from '../utils/style'

export function useMountStyle(cnode: CNode, id?: string, owner?: string): void {
  const disposerRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    disposerRef.current = mountStyle(cnode, id, owner)
    return () => {
      disposerRef.current?.()
      disposerRef.current = null
    }
  }, [cnode, id, owner])
}
