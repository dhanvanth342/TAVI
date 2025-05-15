import SoundPlayer, { SoundPlayerEventData, SoundPlayerSubscription } from 'react-native-sound-player';

// Map of audio file names to their require statements
export const AudioFiles = {
  // Welcome and onboarding
  welcome: require('../../assets/welcome.mp3'),
  getstarted: require('../../assets/getstarted.mp3'),
  
  // Jarvis voice prompts
  jarvis: require('../../assets/jarvis.mp3'),
  jarvisGreeting: require('../../assets/jarvisgreeting.mp3'),
  jarvisAgain: require('../../assets/jarvisagain.mp3'),
  jarvisCamera: require('../../assets/jarviscamera.mp3'),
  jarvisProcessing: require('../../assets/jarvisprocessing.mp3'),
  jarvisResponse: require('../../assets/jarvisresponse.mp3'),
  
  // Video related
  recordingVideo: require('../../assets/recordingvideo.mp3'),
  videoProcessing: require('../../assets/videoprocessing.mp3'),
  videoResponse: require('../../assets/videoresponse.mp3'),
  
  // Error sounds
  audioError: require('../../assets/audioerror.mp3'),
  videoError: require('../../assets/videoerror.mp3'),
  cameraError: require('../../assets/cameraerror.mp3'),
  cameraRecordingError: require('../../assets/camerarecordingerror.mp3'),
  jarvisError: require('../../assets/jerror.mp3'),
  berror: require('../../assets/berror.mp3'),
};

// Type for callback functions
type AudioCallback = () => void;

class AudioManager {
  private static instance: AudioManager;
  private eventSubscriptions: SoundPlayerSubscription[] = [];
  
  private constructor() {
    // Set up event listeners
    this.eventSubscriptions.push(
      SoundPlayer.addEventListener('FinishedPlaying', this.handleFinishedPlaying.bind(this))
    );
    this.eventSubscriptions.push(
      SoundPlayer.addEventListener('FinishedLoading', this.handleFinishedLoading.bind(this))
    );
  }
  
  // Callback storage
  private onPlaybackFinished: AudioCallback | null = null;
  
  // Event handlers
  private handleFinishedPlaying(data: SoundPlayerEventData) {
    if (data.success && this.onPlaybackFinished) {
      this.onPlaybackFinished();
      this.onPlaybackFinished = null;
    }
  }
  
  private handleFinishedLoading(data: SoundPlayerEventData) {
    // You can add loading completion logic here if needed
    console.log('Audio loaded:', data.success);
  }
  
  // Singleton pattern
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  // Play audio file from assets
  public playSound(audioAsset: any, onFinished?: AudioCallback): void {
    try {
      // Stop any currently playing sound
      this.stopSound();
      
      // Set the callback if provided
      if (onFinished) {
        this.onPlaybackFinished = onFinished;
      }
      
      // Play the sound
      SoundPlayer.playAsset(audioAsset);
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  }
  
  // Play audio by key from the AudioFiles map
  public play(key: keyof typeof AudioFiles, onFinished?: AudioCallback): void {
    try {
      const audioAsset = AudioFiles[key];
      this.playSound(audioAsset, onFinished);
    } catch (error) {
      console.error(`Failed to play sound "${key}":`, error);
    }
  }
  
  // Play a sequence of sounds
  public playSequence(keys: (keyof typeof AudioFiles)[], delayBetween: number = 500): void {
    if (keys.length === 0) return;
    
    let currentIndex = 0;
    
    const playNext = () => {
      if (currentIndex < keys.length) {
        const key = keys[currentIndex];
        currentIndex++;
        
        this.play(key, () => {
          setTimeout(playNext, delayBetween);
        });
      }
    };
    
    playNext();
  }
  
  // Pause the current audio
  public pauseSound(): void {
    try {
      SoundPlayer.pause();
    } catch (error) {
      console.error('Failed to pause sound:', error);
    }
  }
  
  // Resume the paused audio
  public resumeSound(): void {
    try {
      SoundPlayer.resume();
    } catch (error) {
      console.error('Failed to resume sound:', error);
    }
  }
  
  // Stop the current audio
  public stopSound(): void {
    try {
      SoundPlayer.stop();
    } catch (error) {
      console.error('Failed to stop sound:', error);
    }
  }
  
  // Clean up resources
  public dispose(): void {
    this.eventSubscriptions.forEach(subscription => subscription.remove());
    this.eventSubscriptions = [];
    this.stopSound();
  }
  public preloadAll(): void {
    Object.values(AudioFiles).forEach((asset) => {
      try {
        SoundPlayer.loadAsset(asset);
      } catch (error) {
        console.warn('Failed to preload asset:', error);
      }
    });
  }
  
}

// Export the singleton instance
export default AudioManager.getInstance(); 