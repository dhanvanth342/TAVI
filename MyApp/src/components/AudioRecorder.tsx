import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ScrollView,
  ViewStyle
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import axios from 'axios';
import {
  PorcupineManager,
  BuiltInKeywords
} from '@picovoice/porcupine-react-native';
import SoundPlayer from 'react-native-sound-player';
import VideoRecorder from './VideoRecorder';
import Video from 'react-native-video';

// Backend URL for emulator and simulator
const BACKEND_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://127.0.0.1:8000',
  default: 'http://127.0.0.1:8000'
});

type AudioResponse = {
  data1: { Record: boolean };
  data2: string;
  data3: string;
  transcript: string;
};

type Message = {
  text: string;
  sender: 'user' | 'Jarvis' | 'assistant';
};

interface AudioRecorderProps {
  porcupineAccessKey: string;
  onRecordingComplete?: (uri: string) => void;
  onMicStatusChange?: (active: boolean) => void;
  onTestMicrophone?: () => Promise<void>;
  onCheckPorcupineStatus?: () => Promise<boolean>;
  style?: ViewStyle;
  greetingsCompleted?: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  porcupineAccessKey,
  onRecordingComplete,
  onMicStatusChange,
  onTestMicrophone,
  onCheckPorcupineStatus,
  style,
  greetingsCompleted
}) => {
  const audioPlayer = useRef(new AudioRecorderPlayer()).current;
  const [porcupine, setPorcupine] = useState<PorcupineManager | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [lastVideoUri, setLastVideoUri] = useState<string | null>(null);

  // Kick off wake-word after greetings
  useEffect(() => {
    if (greetingsCompleted) initPorcupine();
    return () => {
      porcupine?.delete();
      audioPlayer.stopPlayer();
    };
  }, [greetingsCompleted]);

  // Request mic permission (Android)
  const requestMicPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        { title: 'Microphone Permission', message: 'Need mic access for wake word.', buttonPositive: 'OK' }
      );
      console.log('Microphone permission:', res);
      return res === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // Initialize Porcupine
  const initPorcupine = async () => {
    const granted = await requestMicPermission();
    if (!granted) return onMicStatusChange?.(false);
    console.log('Initializing Porcupine...');
    const mgr = await PorcupineManager.fromBuiltInKeywords(
      porcupineAccessKey,
      [BuiltInKeywords.JARVIS],
      async () => {
        console.log('Wake word detected');
        onMicStatusChange?.(true);
        await pausePorcupine();
        appendMessage('Wake word detected—recording audio...', 'Jarvis');
        startAudioRecording();
      }
    );
    setPorcupine(mgr);
    await mgr.start();
    onMicStatusChange?.(true);
    appendMessage('Say "Jarvis" to start.', 'assistant');
  };

  const pausePorcupine = async () => {
    if (!porcupine) return;
    await porcupine.stop();
    onMicStatusChange?.(false);
    console.log('Porcupine paused');
  };

  const resumePorcupine = async () => {
    if (!porcupine) return;
    await porcupine.start();
    onMicStatusChange?.(true);
    console.log('Porcupine resumed');
  };

  const appendMessage = (text: string, sender: Message['sender']) => {
    setMessages(prev => [...prev, { text, sender }]);
  };

  // Audio recording
  const startAudioRecording = async () => {
    console.log('Starting audio recording');
    const path = await audioPlayer.startRecorder();
    setIsRecording(true);
    audioPlayer.addRecordBackListener(e => {
      if (e.currentPosition >= 5000) stopAudioRecording();
    });
    appendMessage('Recording audio...', 'assistant');
  };

  const stopAudioRecording = async () => {
    console.log('Stopping audio recording');
    const path = await audioPlayer.stopRecorder();
    audioPlayer.removeRecordBackListener();
    setIsRecording(false);
    appendMessage('Audio recorded. Sending to server...', 'assistant');
    onRecordingComplete?.(path);
    sendAudioToServer(path);
  };

  // Send audio
  const sendAudioToServer = async (path: string) => {
    const uri = Platform.OS === 'android' ? `file://${path}` : path;
    const data = new FormData();
    data.append('file', { uri, type: 'audio/wav', name: 'input.wav' } as any);
    console.log('Uploading audio:', uri);
    try {
      const { data: resp } = await axios.post<AudioResponse>(`${BACKEND_URL}/process_audio/`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      handleAudioResponse(resp);
    } catch (e) {
      console.error('Audio upload error', e);
      appendMessage('Error sending audio. Listening again.', 'assistant');
      setTimeout(resumePorcupine, 2000);
    }
  };

  const handleAudioResponse = async (resp: AudioResponse) => {
    appendMessage(resp.transcript, 'user');
    appendMessage('Processing response...', 'Jarvis');
    if (resp.data1.Record) {
      appendMessage('Opening video recorder...', 'Jarvis');
      // Show the video recorder modal
      setShowVideo(true);
    } else {
      console.log('🔈 Playing TTS audio');
      await pausePorcupine();
      appendMessage(resp.data2, 'Jarvis');
      try {
        const url = `${BACKEND_URL}${resp.data3}`;
        SoundPlayer.playUrl(url);
        SoundPlayer.addEventListener('FinishedPlaying', () => {
          console.log('🔊 Audio playback finished');
          // Resume wake-word listening after TTS playback
          resumePorcupine();
        });
      } catch (e) {
        console.error('Audio play error:', e);
        resumePorcupine();
      }
    }
  };

  // Video handling
  const handleVideoRecorded = async (uri: string) => {
    console.log('Video path:', uri);
    setShowVideo(false);
    setLastVideoUri(uri);
    appendMessage('Video captured. Sending to server...', 'Jarvis');
    const fileUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
    const data = new FormData();
    data.append('file', { uri: fileUri, type: 'video/mp4', name: 'capture.mp4' } as any);
    try {
      const { data: resp } = await axios.post(`${BACKEND_URL}/process_video/`, data , {/* headers: { 'Content-Type': 'multipart/form-data' } */});
      appendMessage(`Here's what I see: ${resp.text_summary}`, 'Jarvis');
      await pausePorcupine();
      try {
        SoundPlayer.playUrl(`${BACKEND_URL}${resp.audio_file}`);
        SoundPlayer.addEventListener('FinishedPlaying', resumePorcupine);
      } catch {
        resumePorcupine();
      }
    } catch (e) {
      console.error('Video upload error', e);
      appendMessage('Error processing video.', 'assistant');
      setTimeout(resumePorcupine, 2000);
    }
  };

  // UI render
  return (
    <View style={[styles.container, style]}>  
      <ScrollView style={styles.chatContainer} contentContainerStyle={styles.chatContent}>
        {messages.map((msg, idx) => (
          <View key={idx} style={[styles.bubble, msg.sender === 'user' ? styles.userBubble : styles.jarvisBubble]}>  
            <Text style={styles.bubbleText}>{msg.text}</Text>
          </View>
        ))}
        {lastVideoUri && (
          <Video source={{ uri: lastVideoUri }} style={styles.video} controls resizeMode="contain" />
        )}
      </ScrollView>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{isRecording ? 'Recording…' : 'Say "Jarvis" to chat'}</Text>
      </View>

      <VideoRecorder
        visible={showVideo}
        onClose={() => setShowVideo(false)}
        onVideoRecorded={handleVideoRecorded}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f7', padding: 16 },
  chatContainer: { flex: 1 },
  chatContent: { paddingBottom: 20 },
  bubble: { marginVertical: 4, padding: 10, borderRadius: 12, maxWidth: '80%' },
  userBubble: { backgroundColor: '#d1e7dd', alignSelf: 'flex-end' },
  jarvisBubble: { backgroundColor: '#ffffff', alignSelf: 'flex-start' },
  bubbleText: { fontSize: 16, color: '#333' },
  video: { width: '100%', height: 200, borderRadius: 8, marginTop: 8 },
  statusBar: { paddingVertical: 8, borderTopWidth: 1, borderColor: '#ccc' },
  statusText: { textAlign: 'center', color: '#666' }
});

export default AudioRecorder;
