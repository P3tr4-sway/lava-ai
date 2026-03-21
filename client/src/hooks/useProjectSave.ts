import { useState, useRef, useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
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
}

export function useProjectSave({ hasContent, contentFingerprint, buildProjectData }: UseProjectSaveOptions) {
  const upsertProject = useProjectStore((s) => s.upsertProject)
  const [saving, setSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [showSavedBadge, setShowSavedBadge] = useState(false)
  const lastSavedFingerprintRef = useRef('')

  const isDirty = hasContent && !isSaved

  // Reset saved state when content changes after saving
  useEffect(() => {
    if (isSaved && contentFingerprint !== lastSavedFingerprintRef.current) {
      setIsSaved(false)
    }
  }, [contentFingerprint, isSaved])

  // Block navigation when dirty
  const blocker = useBlocker(isDirty)

  const handleSave = async (): Promise<boolean> => {
    if (saving) return false
    setSaving(true)
    try {
      const data = buildProjectData()
      const project = await projectService.create(data)
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
  }

  const handleDialogSave = async () => {
    const ok = await handleSave()
    if (ok) blocker.proceed?.()
  }

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
