// Single source of truth for which moods the model may pick, grouped for the
// prompt (api/lib/prompt.ts's buildOutputFormatInstructions) and flattened for
// validation (chat.ts's parseModelOutput) and the Ollama structured-output
// schema (llm.ts's RESPONSE_SCHEMA). Previously these three lived as separate
// hardcoded lists and drifted: llm.ts's schema only allowed 7 moods while the
// prompt asked the model to pick from ~43, so Ollama's constrained decoding
// made most moods (annoyed, sick, dancing, birthday, ...) impossible outputs
// no matter what the prompt said. One list, three consumers, fixes that.
import type { Mood } from './types.js'

export const MOOD_GROUPS: { label: string; moods: Mood[] }[] = [
  {
    label: 'Everyday reactions',
    moods: ['happy', 'excited', 'content', 'neutral', 'curious', 'confused', 'sad', 'surprised', 'laughing', 'lovestruck'],
  },
  {
    label: 'Your own attitude/quirks',
    moods: ['wink', 'smug', 'annoyed', 'grumpy', 'challenging', 'pout', 'bored', 'proud', 'dizzy', 'thinking', 'scared'],
  },
  {
    label: 'Low-energy/health (see your current energy below)',
    moods: ['sick', 'unwell', 'recovering'],
  },
  {
    label: 'Situational -- use when it fits what is literally happening, not a random pick',
    moods: ['dancing', 'sleepy', 'dozing'],
  },
  {
    label: 'Moves (rare flourishes, not a default pick most turns)',
    moods: ['walk', 'run', 'jump', 'flip', 'backflip', 'spin', 'moonwalk', 'wiggle', 'stretch', 'wave', 'lookaround', 'sit'],
  },
  {
    label: 'Play (fun toy routines -- a real little scene, not a quick flourish)',
    moods: ['skate', 'playball', 'jam'],
  },
  {
    label: 'Special days (only on the actual day, see below)',
    moods: ['birthday', 'christmas', 'halloween', 'newyear', 'valentine'],
  },
]

// 'listening'/'talking' exist in the Mood type and Character.tsx's expression
// set but stay unreachable here -- no voice/TTS feature yet to give them a
// real signal.
export const SELECTABLE_MOODS: Mood[] = MOOD_GROUPS.flatMap((g) => g.moods)
