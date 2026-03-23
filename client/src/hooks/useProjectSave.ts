import { useState, useRef, useEffect, useCallback } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/stores/projectStore'
import { projectService } from '@/services/projectService'
import type { CreateProject } from '@lava/shared'

interface UseProjectSaveOptions {
  /** True when the page has content worth saving */
  hasContent: boolean
  /** String that changes whenever saveable content changes */
  contentFingerprint: string
  /** Builds the project payload to send to the server */
  buildProjectData: () => CreateProject
  /** If editing an existing project, its ID */
  projectId?: string
}

export function useProjectSave({ hasContent, contentFingerprint, buildProjectData, projectId }: UseProjectSaveOptions) {
  const navigate = useNavigate()
  const upsertProject = useProjectStore((s) => s.upsertProject)
  const [saving, setSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(!!projectId)
  const [showSavedBadge, setShowSavedBadge] = useState(false)
  const lastSavedFingerprintRef = useRef('')
  const currentIdRef = useRef<string | undefined>(projectId)

  // Sync projectId when it changes (e.g. navigating to /editor/:id)
  useEffect(() => {
    currentIdRef.current = projectId
    if (projectId) {
      setIsSaved(true)
      lastSavedFingerprintRef.current = contentFingerprint
    }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = hasContent && !isSaved

  // Reset saved state when content changes after saving
  useEffect(() => {
    if (isSaved && contentFingerprint !== lastSavedFingerprintRef.current) {
      setIsSaved(false)
    }
  }, [contentFingerprint, isSaved])

  // Block navigation when dirty
  const blocker = useBlocker(isDirty)

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (saving) return false
    setSaving(true)
    try {
      const data = buildProjectData()
      let project
      if (currentIdRef.current) {
        project = await projectService.update(currentIdRef.current, data)
      } else {
        project = await projectService.create(data)
        currentIdRef.current = project.id
        // Update URL so subsequent saves are updates
        navigate(`/editor/${project.id}`, { replace: true })
      }
      upsertProject(project)
      lastSavedFingerprintRef.current = contentFingerprint
      setIsSaved(true)
      setShowSavedBadge(true)
      setTimeout(() => setShowSavedBadge(false), 3000)
      return true
    } catch (err) {
      console.error('Save project failed:', err)
      return false
    } finally {
      setSaving(false)
    }
  }, [saving, buildProjectData, contentFingerprint, navigate, upsertProject])

  const handleDialogSave = useCallback(async () => {
    const ok = await handleSave()
    if (ok) blocker.proceed?.()
  }, [handleSave, blocker])

  return {
    saving,
    isSaved,
    isDirty,
    showSavedBadge,
    blocker,
    handleSave,
    handleDialogSave,
  }
}
