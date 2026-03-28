import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/spaces/auth/LoginPage'
import { SignupPage } from '@/spaces/auth/SignupPage'
import { HomePage } from '@/spaces/home/HomePage'
import { PackPage } from '@/spaces/pack/PackPage'

// Lazy placeholders — will be replaced in later tasks
const MySongsPageStub = () => <div className="p-8 text-text-primary">My Songs stub</div>
const ProfilePageStub = () => <div className="p-8 text-text-primary">Profile stub</div>

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pack/:id', element: <PackPage /> },
      { path: 'songs', element: <MySongsPageStub /> },
      { path: 'profile', element: <ProfilePageStub /> },
      // Redirects for removed routes
      { path: 'settings', element: <Navigate to="/profile" replace /> },
      // play/:id redirects to /pack/:id
      { path: 'play/:id', lazy: async () => {
        const { PlayRedirect } = await import('@/spaces/pack/PlayRedirect')
        return { Component: PlayRedirect }
      }},
      { path: 'projects', element: <Navigate to="/songs" replace /> },
      { path: 'files', element: <Navigate to="/songs" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes)
