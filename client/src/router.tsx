import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/spaces/home/HomePage'
import { SongsPage } from '@/spaces/learn/SongsPage'
import { JamPage } from '@/spaces/jam/JamPage'
import { PlayHubPage } from '@/spaces/jam/PlayHubPage'
import { LibraryPage } from '@/spaces/library/LibraryPage'
import { SearchResultsPage } from '@/spaces/search/SearchResultsPage'
import { LeadSheetPage } from '@/spaces/editor/LeadSheetPage'

const routes: RouteObject[] = [
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
      { path: 'jam/:id', element: <JamPage /> },
      // Lead Sheet editor — blank project
      { path: 'editor', element: <LeadSheetPage /> },
      { path: 'editor/:id', element: <LeadSheetPage /> },
      // Library (merged library + projects)
      { path: 'library', element: <LibraryPage /> },
      // Search
      { path: 'search', element: <SearchResultsPage /> },
      // Redirects for removed pages
      { path: 'learn', element: <Navigate to="/" replace /> },
      { path: 'create', element: <Navigate to="/" replace /> },
      { path: 'projects', element: <Navigate to="/library" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const router: any = createBrowserRouter(routes)
