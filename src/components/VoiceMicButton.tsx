import { Mic, MicOff } from 'lucide-react'

type Props = {
  listening: boolean
  supported: boolean
  label?: string
  onClick: () => void
}

export function VoiceMicButton({
  listening,
  supported,
  label = 'Voice',
  onClick,
}: Props) {
  if (!supported) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
        listening
          ? 'bg-red-500 text-white'
          : 'text-brand hover:bg-brand-soft hover:text-brand-deep'
      }`}
      aria-pressed={listening}
      aria-label={listening ? 'Stop voice input' : label}
      title={listening ? 'Listening… tap to stop' : label}
    >
      {listening ? (
        <MicOff className="h-3.5 w-3.5" />
      ) : (
        <Mic className="h-3.5 w-3.5" />
      )}
      {listening ? 'Listening…' : label}
    </button>
  )
}
