import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LearnPage } from '@/spaces/learn/LearnPage'
import { JamPage } from '@/spaces/jam/JamPage'
import { CreatePage } from '@/spaces/create/CreatePage'
import { ToolsPage } from '@/spaces/tools/ToolsPage'
import { MyProjectsPage } from '@/spaces/my-projects/MyProjectsPage'

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/learn" replace /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'learn/:id', element: <LearnPage /> },
      { path: 'jam', element: <JamPage /> },
      { path: 'jam/:id', element: <JamPage /> },
      { path: 'create', element: <CreatePage /> },
      { path: 'create/:id', element: <CreatePage /> },
      { path: 'tools', element: <ToolsPage /> },
      { path: 'tools/:id', element: <ToolsPage /> },
      { path: 'projects', element: <MyProjectsPage /> },
      { path: 'projects/:id', element: <MyProjectsPage /> },
    ],
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const router: any = createBrowserRouter(routes)
