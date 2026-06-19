import { createConfig, http } from 'wagmi'
import { tempo } from 'wagmi/chains'
import { tempoWallet } from 'wagmi/connectors'

export const tempoConfig = createConfig({
  chains: [tempo],
  connectors: [tempoWallet()],
  multiInjectedProviderDiscovery: false,
  transports: {
    [tempo.id]: http(),
  },
})
