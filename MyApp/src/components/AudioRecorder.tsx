import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { PorcupineManager, BuiltInKeywords } from '@picovoice/porcupine-react-native';

interface AudioRecorderProps {
  onRecordingComplete?: (uri: string) => void;
  onMicStatusChange?: (status: boolean) => void;
  onTestMicrophone?: () => Promise<void>;
  onCheckPorcupineStatus?: () => Promise<boolean>;
  style?: any;
  porcupineAccessKey: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onRecordingComplete, 
  onMicStatusChange,
  onTestMicrophone,
  onCheckPorcupineStatus,
  style,
  porcupineAccessKey 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioRecorderPlayer] = useState(new AudioRecorderPlayer());
  const [porcupineManager, setPorcupineManager] = useState<PorcupineManager | null>(null);

  const requestRecordAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'App needs access to your microphone to detect wake word.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        console.log('Microphone permission:', granted ? 'Granted' : 'Denied');
        return granted;
      } catch (err) {
        console.error('Permission check failed:', err);
        return false;
      }
    }
    return true;
  };

  const initPorcupine = async () => {
    try {
      console.log('Initializing Porcupine...');
      const keywords: BuiltInKeywords[] = [BuiltInKeywords.JARVIS];
      
      const manager = await PorcupineManager.fromBuiltInKeywords(
        porcupineAccessKey,
        keywords,
        () => {
          // Wake word detected
          console.log('Jarvis detected! Starting audio recording...');
          if (!isRecording) {
            startRecording();
          }
        },
        (error) => {
          console.error('Porcupine processing error:', error);
          onMicStatusChange?.(false);
        }
      );
      
      console.log('Porcupine initialized successfully');
      setPorcupineManager(manager);
      await manager.start();
      onMicStatusChange?.(true);
      console.log('Porcupine started listening');
    } catch (error) {
      console.error('Failed to initialize Porcupine:', error);
      onMicStatusChange?.(false);
    }
  };

  useEffect(() => {
    const setupPorcupine = async () => {
      const hasPermission = await requestRecordAudioPermission();
      if (hasPermission) {
        await initPorcupine();
      } else {
        console.error('Microphone permission denied');
        onMicStatusChange?.(false);
      }
    };

    setupPorcupine();

    return () => {
      if (porcupineManager) {
        porcupineManager.delete();
      }
      if (isRecording) {
        stopRecording();
      }
      onMicStatusChange?.(false);
    };
  }, [porcupineAccessKey]);

  const startRecording = async () => {
    const hasPermission = await requestRecordAudioPermission();
    if (!hasPermission) {
      console.log('Permission denied');
      return;
    }

    try {
      const result = await audioRecorderPlayer.startRecorder();
      console.log('Microphone turned on - Recording started');
      audioRecorderPlayer.addRecordBackListener((e) => {
        setRecordingTime(e.currentPosition);
        // Stop recording after 7 seconds
        if (e.currentPosition >= 7000) {
          stopRecording();
        }
      });
      setIsRecording(true);
      console.log('Recording started:', result);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setRecordingTime(0);
      console.log('Recording stopped:', result);
      if (onRecordingComplete) {
        onRecordingComplete(result);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const testMicrophone = async () => {
    try {
      const result = await audioRecorderPlayer.startRecorder();
      console.log('Microphone test started:', result);
      // Record for 1 second
      setTimeout(async () => {
        const testResult = await audioRecorderPlayer.stopRecorder();
        console.log('Microphone test completed:', testResult);
      }, 1000);
    } catch (error) {
      console.error('Microphone test failed:', error);
    }
  };

  const checkPorcupineStatus = async () => {
    if (porcupineManager) {
      try {
        // Check if manager exists and is not null
        return true;
      } catch (error) {
        console.error('Porcupine status check failed:', error);
        return false;
      }
    }
    return false;
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.timer}>{formatTime(recordingTime)}</Text>
      <Text style={styles.status}>
        {isRecording ? 'Recording...' : 'Say "Jarvis" to start recording'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  timer: {
    fontSize: 24,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#333',
  },
  status: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  }
});

export default AudioRecorder;