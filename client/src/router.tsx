import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/spaces/auth/LoginPage'
import { SignupPage } from '@/spaces/auth/SignupPage'
import { HomePage } from '@/spaces/home/HomePage'

// Lazy placeholders — will be replaced in later tasks
const PackPageStub = () => <div className="p-8 text-text-primary">Pack page stub</div>
const MySongsPageStub = () => <div className="p-8 text-text-primary">My Songs stub</div>
const ProfilePageStub = () => <div className="p-8 text-text-primary">Profile stub</div>

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pack/:id', element: <PackPageStub /> },
      { path: 'songs', element: <MySongsPageStub /> },
      { path: 'profile', element: <ProfilePageStub /> },
      // Redirects for removed routes
      { path: 'settings', element: <Navigate to="/profile" replace /> },
      // play/:id needs a component to read the param and redirect to /pack/:id
      { path: 'play/:id', lazy: async () => {
        // @ts-expect-error — PlayRedirect does not exist yet; will be created in a later task
        const { PlayRedirect } = await import('@/spaces/pack/PlayRedirect')
        return { Component: PlayRedirect }
      }},
      { path: 'projects', element: <Navigate to="/songs" replace /> },
      { path: 'files', element: <Navigate to="/songs" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const router: any = createBrowserRouter(routes)
