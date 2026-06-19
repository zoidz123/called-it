'use client'

import { useAccount, useConnect, useConnectors, useDisconnect } from 'wagmi'

export function TempoAccountButton() {
  const { address, isConnected } = useAccount()
  const connectors = useConnectors()
  const { connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const connector = connectors[0]

  if (isConnected && address) {
    return (
      <button className="tempo-account-button connected" type="button" onClick={() => disconnect()}>
        <span>Tempo</span>
        {shortAddress(address)}
      </button>
    )
  }

  return (
    <button
      className="tempo-account-button"
      disabled={!connector || isPending}
      type="button"
      onClick={() => connector && connect({ connector })}
    >
      {isPending ? 'Opening Tempo...' : 'Connect Tempo'}
    </button>
  )
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
