/*import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import SoundPlayer from 'react-native-sound-player';

interface AudioPlayerProps {
  source: any; // Can be a require() call for asset or a string URL
  isAsset?: boolean; // Flag to determine if source is an asset or URL
  onEnd?: () => void;
  autoPlay?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  source, 
  isAsset = true, 
  onEnd,
  autoPlay = false
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  
  useEffect(() => {
    // Set up event listeners
    const onFinishedPlayingSubscription = SoundPlayer.addEventListener('FinishedPlaying', ({ success }) => {
      if (success) {
        setStatus('idle');
        if (onEnd) onEnd();
      }
    });

    const onFinishedLoadingSubscription = SoundPlayer.addEventListener('FinishedLoading', ({ success }) => {
      if (success) {
        setStatus('playing');
      } else {
        setStatus('error');
      }
    });

    // Start playing if autoPlay is true
    if (autoPlay) {
      playAudio();
    }

    // Clean up when component unmounts
    return () => {
      onFinishedPlayingSubscription.remove();
      onFinishedLoadingSubscription.remove();
      SoundPlayer.stop();
    };
  }, [source]);

  const playAudio = () => {
    try {
      setStatus('loading');
      if (isAsset) {
        // Play from asset
        SoundPlayer.playAsset(source);
      } else {
        // Play from URL
        SoundPlayer.playUrl(source);
      }
    } catch (e) {
      console.error('Cannot play the sound file', e);
      setStatus('error');
      // Call onEnd after a delay even if there's an error
      setTimeout(() => {
        if (onEnd) onEnd();
      }, 2000);
    }
  };

  const pauseAudio = () => {
    try {
      SoundPlayer.pause();
      setStatus('paused');
    } catch (e) {
      console.error('Cannot pause audio', e);
    }
  };

  const resumeAudio = () => {
    try {
      SoundPlayer.resume();
      setStatus('playing');
    } catch (e) {
      console.error('Cannot resume audio', e);
    }
  };

  const stopAudio = () => {
    try {
      SoundPlayer.stop();
      setStatus('idle');
    } catch (e) {
      console.error('Cannot stop audio', e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {typeof source === 'string' ? source : 'Playing audio...'}
      </Text>
      <Text style={styles.status}>Status: {status}</Text>
      
      <View style={styles.controls}>
        {status === 'idle' && (
          <Button title="Play" onPress={playAudio} />
        )}
        {status === 'playing' && (
          <Button title="Pause" onPress={pauseAudio} />
        )}
        {status === 'paused' && (
          <Button title="Resume" onPress={resumeAudio} />
        )}
        {(status === 'playing' || status === 'paused') && (
          <Button title="Stop" onPress={stopAudio} />
        )}
      </View>
      
      {status === 'error' && (
        <Text style={styles.error}>
          Could not play audio. Using fallback timer instead.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  status: {
    marginBottom: 10,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  error: {
    color: 'red',
    marginTop: 5,
  },
});

export default AudioPlayer; */