import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/spaces/home/HomePage'
import { SongsPage } from '@/spaces/learn/SongsPage'
import { JamPage } from '@/spaces/jam/JamPage'
import { PlayHubPage } from '@/spaces/jam/PlayHubPage'
import { TonePage } from '@/spaces/jam/TonePage'
import { MyProjectsPage } from '@/spaces/my-projects/MyProjectsPage'
import { SearchResultsPage } from '@/spaces/search/SearchResultsPage'
import { LeadSheetPage } from '@/spaces/editor/LeadSheetPage'
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
      { path: 'play/:id', element: <SongsPage /> },
      // Legacy routes → redirect to new player
      { path: 'learn/songs/:id', element: <SongsPage /> },
      // Jam / free play
      { path: 'jam', element: <PlayHubPage /> },
      { path: 'jam/new', element: <TonePage /> },
      { path: 'jam/:id', element: <JamPage /> },
      // Lead Sheet editor — blank project
      { path: 'editor', element: <LeadSheetPage /> },
      { path: 'editor/:id', element: <LeadSheetPage /> },
      // Projects
      { path: 'projects', element: <MyProjectsPage /> },
      // Search
      { path: 'search', element: <SearchResultsPage /> },
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
