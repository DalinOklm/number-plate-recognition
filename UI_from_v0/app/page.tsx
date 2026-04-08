import { ScannerSettingsProvider } from "@/contexts/scanner-settings"
import { ScannerUI } from "@/components/scanner-ui"

export default function Home() {
  return (
    <ScannerSettingsProvider>
      <ScannerUI />
    </ScannerSettingsProvider>
  )
}
