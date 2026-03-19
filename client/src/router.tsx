import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/spaces/home/HomePage'
import { LearnPage } from '@/spaces/learn/LearnPage'
import { JamPage } from '@/spaces/jam/JamPage'
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
      { path: 'learn/:id', element: <LearnPage /> },
      { path: 'jam', element: <JamPage /> },
      { path: 'jam/:id', element: <JamPage /> },
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
