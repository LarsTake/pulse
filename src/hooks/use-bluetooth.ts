"use client"

import * as React from "react"

const noop = () => () => {}

/** Whether this browser offers Web Bluetooth (Chrome, Edge; not Safari). Null on the server and before hydration. */
export function useBluetoothSupport(): boolean | null {
  return React.useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && "bluetooth" in navigator,
    () => null
  )
}
