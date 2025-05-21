import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ScrollView
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { PorcupineManager, BuiltInKeywords } from '@picovoice/porcupine-react-native';
import SoundPlayer from 'react-native-sound-player';

// Update the BACKEND_URL to handle Android emulator
const BACKEND_URL = Platform.select({
  android: 'http://10.0.2.2:8000', // Android emulator localhost
  ios: 'http://127.0.0.1:8000',    // iOS simulator localhost
  default: 'http://127.0.0.1:8000'
});

interface AudioRecorderProps {
  onRecordingComplete?: (uri: string) => void;
  onMicStatusChange?: (status: boolean) => void;
  onTestMicrophone?: () => Promise<void>;
  onCheckPorcupineStatus?: () => Promise<boolean>;
  style?: any;
  porcupineAccessKey: string;
}

interface AudioResponse {
  data1: {
    Record: boolean;
    General: boolean;
    Fallback: boolean;
    Tavi: boolean;
  };
  data2: string;
  data3: string;
  transcript: string;
}

interface Message {
  text: string;
  sender: 'user' | 'Jarvis' | 'assistant';
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const processAudioResponse = async (data: AudioResponse) => {
    try {
      setIsProcessing(true);
      
      // Add user's transcript message
      setMessages(prev => [...prev, { text: data.transcript, sender: 'user' }]);
      
      // Add processing message
      setMessages(prev => [...prev, { text: "Hang tight, I'm processing that for you!", sender: 'Jarvis' }]);

      if (data.data1.Record) {
        // Handle Record intent
        setMessages(prev => [...prev, { text: "Got it! You'd like to start recording—camera's coming on.", sender: 'Jarvis' }]);
        // TODO: Add your video capture logic here
      } else {
        // Handle normal response
        setMessages(prev => [...prev, { text: "Umm... here's what I know!", sender: 'Jarvis' }]);
        
        // Play the audio response
        const audioUrl = `${BACKEND_URL}${data.data3}`;
        try {
          await SoundPlayer.playUrl(audioUrl);
        } catch (error) {
          console.error('Error playing audio:', error);
        }

        // Add the response text
        setMessages(prev => [...prev, { text: data.data2, sender: 'Jarvis' }]);
      }
    } catch (error) {
      console.error('Error processing audio response:', error);
      setMessages(prev => [...prev, { text: "Sorry, I encountered an error processing your request.", sender: 'Jarvis' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendAudioToBackend = async (audioFilePath: string) => {
    try {
      const fileUri = Platform.OS === 'android' 
        ? `file://${audioFilePath}`
        : audioFilePath;

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: 'audio/mp4',
        name: 'recording.m4a'
      } as any);

      console.log('Sending audio to backend:', {
        url: `${BACKEND_URL}/process_audio/`,
        fileUri
      });

      const response = await fetch(`${BACKEND_URL}/process_audio/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Audio processed successfully:', data);
        await processAudioResponse(data);
        return data;
      } else {
        console.error('Failed to process audio:', response.status);
      }
    } catch (error) {
      console.error('Error sending audio to backend:', error);
    }
  };

  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setRecordingTime(0);
      console.log('Recording stopped:', result);
      
      // Send the audio to backend
      await sendAudioToBackend(result);
      
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
      <ScrollView style={styles.messagesContainer}>
        {messages.map((message, index) => (
          <View 
            key={index} 
            style={[
              styles.messageBubble,
              message.sender === 'user' ? styles.userMessage : styles.jarvisMessage
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.recorderContainer}>
        <Text style={styles.timer}>{formatTime(recordingTime)}</Text>
        <Text style={styles.status}>
          {isRecording ? 'Recording...' : 'Say "Jarvis" to start recording'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 20,
  },
  recorderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#e3f2fd',
    alignSelf: 'flex-end',
  },
  jarvisMessage: {
    backgroundColor: '#f5f5f5',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
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