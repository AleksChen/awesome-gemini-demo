import { proxy } from 'valtio'

export type AppMode = 'edit' | 'play'

export interface AppState {
  mode: AppMode
  title: string
  bgmUrl: string | null
  images: string[] // URLs or Base64
  isReady: boolean
  debug: boolean
  showStars: boolean
  activeImage: string | null
  quality: 'high' | 'low'
}

// Reactive state for UI
export const appState = proxy<AppState>({
  mode: 'edit',
  title: 'Merry Christmas',
  bgmUrl: '/christmas-music-merry-christmas-264517.mp3',
  images: [],
  isReady: false,
  debug: false,
  showStars: true,
  activeImage: null,
  quality: 'high',
})
