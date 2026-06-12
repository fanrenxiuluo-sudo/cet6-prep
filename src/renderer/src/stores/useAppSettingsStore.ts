import { create } from 'zustand';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  autoPlayAudio: boolean;
  showExplanation: boolean;
  dailyGoal: number;
  reviewRemind: boolean;
  soundEffect: boolean;
  exportPath: string;
}

interface AppSettingsState {
  settings: AppSettings;
  loaded: boolean;
  setSettings: (partial: Partial<AppSettings>) => void;
  replaceSettings: (settings: AppSettings) => void;
}

const DEFAULTS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  autoPlayAudio: true,
  showExplanation: true,
  dailyGoal: 20,
  reviewRemind: true,
  soundEffect: true,
  exportPath: '',
};

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  settings: DEFAULTS,
  loaded: false,
  setSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),
  replaceSettings: (settings) => set({ settings: { ...DEFAULTS, ...settings }, loaded: true }),
}));

/** 简单浏览器内提示音（不依赖外部资源） */
let lastBeepAt = 0;
export function playFeedbackSound(kind: 'correct' | 'wrong' = 'correct'): void {
  const { settings } = useAppSettingsStore.getState();
  if (!settings.soundEffect) return;
  const now = Date.now();
  if (now - lastBeepAt < 80) return;
  lastBeepAt = now;
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = kind === 'correct' ? 880 : 220;
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (kind === 'correct' ? 0.12 : 0.22));
    o.onended = () => ctx.close().catch(() => undefined);
  } catch {
    /* ignore */
  }
}
