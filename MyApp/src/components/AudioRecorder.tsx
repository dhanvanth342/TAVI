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
import VideoRecorder from './VideoRecorder';
import Video from 'react-native-video';

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

  // For video capture
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [lastVideoPath, setLastVideoPath] = useState<string | null>(null);

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
          console.log('🎤 JARVIS DETECTED! Wake word triggered!');
          onMicStatusChange?.(true); // Keep mic active during detection
          
          if (!isRecording) {
            console.log('✅ Starting audio recording after wake word detection');
            startRecording();
          } else {
            console.log('⚠️ Already recording, ignoring wake word');
          }
        },
        (error) => {
          console.error('Porcupine processing error:', error);
          console.log('Attempting to recover from Porcupine error...');
          setTimeout(() => {
            startNewPorcupineListening();
          }, 2000);
        }
      );

      console.log('Porcupine initialized successfully');
      setPorcupineManager(manager);
      await manager.start();
      onMicStatusChange?.(true); // Ensure mic status is active
      console.log('Porcupine started listening for "Jarvis"');
    } catch (error) {
      console.error('Failed to initialize Porcupine:', error);
      onMicStatusChange?.(false);
    }
  };

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
      onMicStatusChange?.(true);

      // Add user's transcript message
      setMessages(prev => [...prev, { text: data.transcript, sender: 'user' }]);

      // Add processing message
      setMessages(prev => [...prev, { text: "Hang tight, I'm processing that for you!", sender: 'Jarvis' }]);

      if (data.data1.Record) {
        setMessages(prev => [...prev, { text: "Got it! You'd like to start recording—camera's coming on.", sender: 'Jarvis' }]);
        setShowVideoRecorder(true);
      } else {
        setMessages(prev => [...prev, { text: "Umm... here's what I know!", sender: 'Jarvis' }]);
        
        // Play audio with error handling
        const audioUrl = `${BACKEND_URL}${data.data3}`;
        try {
          await SoundPlayer.playUrl(audioUrl);
        } catch (audioError) {
          console.error('Error playing audio:', audioError);
          setMessages(prev => [...prev, { text: "I had trouble playing the audio, but here's the text response.", sender: 'Jarvis' }]);
        }
        
        setMessages(prev => [...prev, { text: data.data2, sender: 'Jarvis' }]);
        
        // Restart Porcupine after successful response
        setTimeout(() => {
          startNewPorcupineListening();
        }, 2000);
      }
    } catch (error) {
      console.error('Error processing audio response:', error);
      setMessages(prev => [...prev, { text: "Sorry, I encountered an error processing your request.", sender: 'Jarvis' }]);
      setTimeout(() => {
        startNewPorcupineListening();
      }, 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendAudioToBackend = async (audioFilePath: string, retryCount = 0) => {
    const maxRetries = 2;
    
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
        fileUri,
        attempt: retryCount + 1
      });

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${BACKEND_URL}/process_audio/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
        signal: controller.signal, // Add abort signal
      });

      clearTimeout(timeoutId); // Clear timeout if request succeeds

      if (response.ok) {
        const data = await response.json();
        console.log('Audio processed successfully:', data);
        await processAudioResponse(data);
        return data;
      } else {
        console.error('Failed to process audio:', response.status);
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error sending audio to backend (attempt ${retryCount + 1}):`, error);
      
      // Type guard for error
      const isNetworkError = error instanceof Error && (
        error.name === 'TypeError' || 
        error.name === 'AbortError' ||
        error.message.includes('Network request failed')
      );
      
      // Retry logic for network errors
      if (retryCount < maxRetries && isNetworkError) {
        console.log(`Retrying audio upload... (${retryCount + 1}/${maxRetries})`);
        setMessages(prev => [...prev, { 
          text: `Connection hiccup, trying again... (${retryCount + 1}/${maxRetries + 1})`, 
          sender: 'Jarvis' 
        }]);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return sendAudioToBackend(audioFilePath, retryCount + 1);
      }
      
      // Max retries reached or non-network error
      const errorMessage = retryCount >= maxRetries 
        ? "I'm having trouble connecting to my brain right now. Let me get back to listening!"
        : "Hmm, seems like I lost connection. No worries, I'm back to listening now!";
        
      setMessages(prev => [...prev, { 
        text: errorMessage, 
        sender: 'Jarvis' 
      }]);
      
      // Always restart Porcupine on failure
      setTimeout(() => {
        startNewPorcupineListening();
      }, 2000);
    }
  };

  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setRecordingTime(0);
      console.log('Recording stopped and microphone released:', result);

      // IMPORTANT: Wait a moment for microphone to be fully released
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send the audio to backend
      await sendAudioToBackend(result);

      if (onRecordingComplete) {
        onRecordingComplete(result);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      // Still try to restart Porcupine even if stopping fails
      setTimeout(() => {
        startNewPorcupineListening();
      }, 2000);
    }
  };

  // VIDEO HANDLING - Updated to match Python code behavior
  const handleVideoRecorded = async (videoFile: string) => {
    console.log('Received video file path:', videoFile);
    
    setLastVideoPath(videoFile);
    setMessages(prev => [...prev, { text: "Recording video for 5 seconds...", sender: 'Jarvis' }]);
    setShowVideoRecorder(false);

    // Send video to backend - matching Python implementation
    try {
      // Processing message (like Python code)
      setMessages(prev => [...prev, { text: "Just a moment... I'm processing what's around you.", sender: 'Jarvis' }]);
      onMicStatusChange?.(true); // Keep mic active during video processing
      
      // Ensure proper file URI format
      let fileUri = videoFile;
      if (Platform.OS === 'android' && !videoFile.startsWith('file://')) {
        fileUri = `file://${videoFile}`;
      }
      
      console.log('Formatted file URI for upload:', fileUri);

      const formData = new FormData();
      
      // Generate filename similar to Python: f"{uuid.uuid4()}_video.mp4"
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const fileName = `${randomId}_${timestamp}_video.mp4`;
      
      formData.append('file', {
        uri: fileUri,
        type: 'video/mp4', // Force MP4 type
        name: fileName,
      } as any);

      console.log('Sending video to backend:', {
        url: `${BACKEND_URL}/process_video/`,
        fileUri,
        fileName
      });

      // Send to backend (matching Python requests.post)
      const response = await fetch(`${BACKEND_URL}/process_video/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (response.status === 200) { // Matching Python: if response.status_code == 200
        const videoData = await response.json();
        console.log('Video processed successfully:', videoData);
        
        const textSummary = videoData.text_summary || '';
        const videoAudioRelative = videoData.audio_file || '';
        const fullAudioUrl = `${BACKEND_URL}${videoAudioRelative}`;

        // Display video summary (matching Python behavior)
        setMessages(prev => [
          ...prev,
          { text: `Based on what I see, here's my take on what's around you: ${textSummary}`, sender: 'Jarvis' }
        ]);
        
        // Play TTS audio (matching Python self.play_audio(full_audio_url))
        try {
          await SoundPlayer.playUrl(fullAudioUrl);
          console.log('Playing video summary audio:', fullAudioUrl);
        } catch (e) {
          console.error('Could not play video summary audio:', e);
        }
        
        // Note: Video display is already handled by lastVideoPath state
        setMessages(prev => [...prev, { text: "Saving your video in our chat", sender: 'assistant' }]);
        
        // LONGER DELAY before restarting Porcupine after video processing
        setTimeout(() => {
          console.log('🔄 Restarting Porcupine after video processing...');
          startNewPorcupineListening();
        }, 5000); // Increased to 5 seconds
        
      } else {
        console.error('Backend error:', response.status);
        setMessages(prev => [...prev, { text: `Error from video API: ${response.status}`, sender: 'Jarvis' }]);
        // Start new instance even on error
        setTimeout(() => {
          startNewPorcupineListening();
        }, 3000);
      }
    } catch (err) {
      console.error('Video capture error:', err);
      setMessages(prev => [...prev, { 
        text: "Error during video capture. Please try again.", 
        sender: 'Jarvis' 
      }]);
      // Start new instance on error
      setTimeout(() => {
        startNewPorcupineListening();
      }, 3000);
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

  // Start new Porcupine listening session
  const startNewPorcupineListening = async () => {
    try {
      console.log('🔄 Starting new Porcupine listening session...');
      
      // IMPORTANT: Make sure audio recorder is completely stopped
      if (isRecording) {
        console.log('⚠️ Audio still recording, stopping first...');
        try {
          await audioRecorderPlayer.stopRecorder();
          audioRecorderPlayer.removeRecordBackListener();
          setIsRecording(false);
          setRecordingTime(0);
        } catch (e) {
          console.warn('Error stopping audio recorder:', e);
        }
      }

      // Clean up existing instance if it exists
      if (porcupineManager) {
        try {
          await porcupineManager.stop();
          porcupineManager.delete();
          console.log('Previous Porcupine instance cleaned up');
        } catch (cleanupError) {
          console.warn('Error cleaning up previous Porcupine:', cleanupError);
        }
      }
      
      // Reset the manager
      setPorcupineManager(null);
      
      // IMPORTANT: Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create and start new Porcupine instance
      await initPorcupine();
      console.log('✅ New Porcupine instance created and listening for "Jarvis"');
      setMessages(prev => [...prev, { text: "Just say 'Jarvis' if you need my help again!", sender: 'assistant' }]);
      
    } catch (error) {
      console.error('Failed to start new Porcupine:', error);
      onMicStatusChange?.(true); // Keep mic active even on error
      
      setMessages(prev => [...prev, { 
        text: "Having some trouble with my hearing, but I'll keep trying to listen!", 
        sender: 'Jarvis' 
      }]);
      
      // Retry after a longer delay
      setTimeout(() => {
        console.log('🔄 Retrying Porcupine initialization...');
        startNewPorcupineListening();
      }, 5000); // Increased delay to 5 seconds
    }
  };

  // Add a test function to check if wake word detection is working:
  const testWakeWordDetection = () => {
    console.log('🧪 Testing wake word detection...');
    console.log('Porcupine manager exists:', !!porcupineManager);
    console.log('Is recording:', isRecording);
    console.log('Current state:', { isRecording, isProcessing });
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
      // Only cleanup when component unmounts
      if (porcupineManager) {
        porcupineManager.delete();
      }
      if (isRecording) {
        stopRecording();
      }
      // Only set mic to false on component unmount
      onMicStatusChange?.(false);
    };
  }, [porcupineAccessKey]);

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

        {/* Video preview */}
        {lastVideoPath && (
          <View style={{ marginVertical: 10, alignItems: 'center' }}>
            <Text style={{ marginBottom: 4 }}>Your Recorded Video:</Text>
            <Video
              source={{ uri: lastVideoPath }}
              style={{ width: 320, height: 180, borderRadius: 10 }}
              controls
              resizeMode="contain"
              paused={false}
              repeat={true}
            />
          </View>
        )}
      </ScrollView>

      <View style={styles.recorderContainer}>
        <Text style={styles.timer}>{formatTime(recordingTime)}</Text>
        <Text style={styles.status}>
          {isRecording ? 'Recording...' : 'Say "Jarvis" to start recording'}
        </Text>
      </View>

      {/* Video recorder modal */}
      <VideoRecorder
        visible={showVideoRecorder}
        onClose={() => setShowVideoRecorder(false)}
        onVideoRecorded={handleVideoRecorded}
      />
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
