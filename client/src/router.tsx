import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/spaces/home/HomePage'
import { ScorePage } from '@/spaces/learn/SongsPage'
import { JamPage } from '@/spaces/jam/JamPage'
import { PlayPage } from '@/spaces/jam/PlayHubPage'
import { TonePage } from '@/spaces/jam/TonePage'
import { MyProjectsPage } from '@/spaces/my-projects/MyProjectsPage'
import { SearchResultsPage } from '@/spaces/search/SearchResultsPage'
import { LeadSheetPage } from '@/spaces/editor/LeadSheetPage'
import { ToolsPage } from '@/spaces/tools/ToolsPage'
import { SettingsPage } from '@/spaces/settings/SettingsPage'
import { PricingPage } from '@/spaces/pricing/PricingPage'
import { LoginPage } from '@/spaces/auth/LoginPage'
import { SignupPage } from '@/spaces/auth/SignupPage'

const routes: RouteObject[] = [
  // Auth pages — outside AppShell
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  // App — inside AppShell (auth-gated)
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      // Player — unified score + accompaniment
      { path: 'score/:id', element: <ScorePage /> },
      // Legacy routes → redirect to score page
      { path: 'learn/songs/:id', element: <ScorePage /> },
      // Play hub (was /jam)
      { path: 'play', element: <PlayPage /> },
      { path: 'play/new', element: <TonePage /> },
      { path: 'play/:id', element: <JamPage /> },
      // Lead Sheet editor — blank project
      { path: 'editor', element: <LeadSheetPage /> },
      { path: 'editor/:id', element: <LeadSheetPage /> },
      // Projects
      { path: 'projects', element: <MyProjectsPage /> },
      // Search
      { path: 'search', element: <SearchResultsPage /> },
      // Tools (Geist experiment)
      { path: 'tools', element: <ToolsPage /> },
      // Settings & Pricing
      { path: 'settings', element: <SettingsPage /> },
      { path: 'pricing', element: <PricingPage /> },
      // Redirects for removed pages
      { path: 'learn', element: <Navigate to="/" replace /> },
      { path: 'create', element: <Navigate to="/" replace /> },
      { path: 'library', element: <Navigate to="/projects" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const router: any = createBrowserRouter(routes)
