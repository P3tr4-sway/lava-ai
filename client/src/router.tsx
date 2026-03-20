import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/spaces/home/HomePage'
import { LearnPage } from '@/spaces/learn/LearnPage'
import { SongsPage } from '@/spaces/learn/SongsPage'
import { JamPage } from '@/spaces/jam/JamPage'
import { PlayHubPage } from '@/spaces/jam/PlayHubPage'
import { BackingTracksPage } from '@/spaces/backing-tracks/BackingTracksPage'
import { ChordChartsPage } from '@/spaces/chord-charts/ChordChartsPage'
import { CreatePage } from '@/spaces/create/CreatePage'
import { MyProjectsPage } from '@/spaces/my-projects/MyProjectsPage'
import { LibraryPage } from '@/spaces/library/LibraryPage'

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'learn/songs', element: <SongsPage /> },
      { path: 'learn/songs/:id', element: <SongsPage /> },
      { path: 'learn/jam', element: <JamPage /> },
      { path: 'learn/techniques', element: <LearnPage /> },
      { path: 'backing-tracks', element: <BackingTracksPage /> },
      { path: 'chord-charts', element: <ChordChartsPage /> },
      { path: 'jam', element: <PlayHubPage /> },
      { path: 'jam/:id', element: <PlayHubPage /> },
      { path: 'create', element: <CreatePage /> },
      { path: 'create/:id', element: <CreatePage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'projects', element: <MyProjectsPage /> },
      { path: 'projects/:id', element: <MyProjectsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const router: any = createBrowserRouter(routes)
