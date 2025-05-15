declare module 'react-native-sound-player' {
  export interface SoundPlayerEventData {
    success?: boolean;
    url?: string;
    name?: string;
    type?: string;
  }

  export type SoundPlayerEvent = 
    | 'FinishedPlaying'
    | 'FinishedLoading'
    | 'FinishedLoadingURL'
    | 'FinishedLoadingFile';

  export interface SoundPlayerSubscription {
    remove: () => void;
  }

  export interface SoundPlayer {
    playSoundFile: (name: string, type: string) => void;
    playAsset: (asset: any) => void;
    playUrl: (url: string) => void;
    loadSoundFile: (name: string, type: string) => void;
    loadAsset: (asset: any) => void;
    loadUrl: (url: string) => void;
    play: () => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    seek: (seconds: number) => void;
    setVolume: (volume: number) => void;
    getInfo: () => Promise<{ currentTime: number, duration: number }>;
    addEventListener: (
      event: SoundPlayerEvent, 
      callback: (data: SoundPlayerEventData) => void
    ) => SoundPlayerSubscription;
  }

  const SoundPlayer: SoundPlayer;
  export default SoundPlayer;
} 