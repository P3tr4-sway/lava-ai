import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/spaces/auth/LoginPage'
import { SignupPage } from '@/spaces/auth/SignupPage'
import { HomePage } from '@/spaces/home/HomePage'
import { EditorPage } from '@/spaces/pack/EditorPage'
import { MySongsPage } from '@/spaces/songs/MySongsPage'
import { ProfilePage } from '@/spaces/profile/ProfilePage'

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/pack/:id', element: <EditorPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'songs', element: <MySongsPage /> },
      { path: 'profile', element: <ProfilePage /> },
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
