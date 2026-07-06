export type Mood = 'happy' | 'curious' | 'sleepy' | 'excited' | 'confused' | 'neutral' | 'lovestruck'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
