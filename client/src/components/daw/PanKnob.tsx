import { useEffect, useRef } from 'react'

interface PanKnobProps {
  value: number
  onChange: (v: number) => void
}

export function PanKnob({ value, onChange }: PanKnobProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const delta = (dragRef.current.startY - e.clientY) * 1.5
      onChangeRef.current(Math.max(-100, Math.min(100, Math.round(dragRef.current.startValue + delta))))
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const rotation = (value / 100) * 135
  const label = value > 0 ? `R${value}` : value < 0 ? `L${Math.abs(value)}` : 'C'

  return (
    <div
      onPointerDown={(e) => {
        dragRef.current = { startY: e.clientY, startValue: value }
        e.preventDefault()
      }}
      className="w-6 h-6 rounded-full bg-text-primary/10 border-2 border-text-primary/20 shrink-0 flex items-center justify-center cursor-ns-resize select-none"
      title={`Pan: ${label}`}
    >
      <div
        className="w-0.5 h-[10px] bg-text-primary/50 rounded-full"
        style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center bottom' }}
      />
    </div>
  )
}
