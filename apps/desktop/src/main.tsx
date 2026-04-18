import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'dialkit/styles.css'
import App from './App.tsx'
import { createTauriProvider } from '@/services/tauri-provider'
import { DataProviderRoot, setDataProvider } from '@/services/provider-context'

// Initialize the DataProvider before anything renders.
// setDataProvider() makes it available to Zustand stores (non-React code).
// <DataProviderRoot> makes it available to React hooks via useDataProvider().
const tauriProvider = createTauriProvider()
setDataProvider(tauriProvider)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProviderRoot provider={tauriProvider}>
      <App />
    </DataProviderRoot>
  </StrictMode>,
)
