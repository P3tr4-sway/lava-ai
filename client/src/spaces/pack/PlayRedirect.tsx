import { Navigate, useParams } from 'react-router-dom'

export function PlayRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/pack/${id}`} replace />
}
