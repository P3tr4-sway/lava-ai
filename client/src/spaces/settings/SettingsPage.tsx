import { Navigate } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { AccountSection } from '@/components/settings/AccountSection'
import { PreferencesSection } from '@/components/settings/PreferencesSection'
import { SubscriptionSection } from '@/components/settings/SubscriptionSection'
import { useAuthStore } from '@/stores/authStore'

export function SettingsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-text-primary mb-6">Settings</h1>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <AccountSection />
          </TabsContent>
          <TabsContent value="preferences">
            <PreferencesSection />
          </TabsContent>
          <TabsContent value="subscription">
            <SubscriptionSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
