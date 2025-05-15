/*import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import AudioPlayer from './AudioPlayer';
import axios from 'axios';

interface MicRecorderProps {
  onRecordingComplete?: () => void;
  backendUrl: string;
}

const MicRecorder: React.FC<MicRecorderProps> = ({ onRecordingComplete, backendUrl }) => {
  const [isRecording, setIsRecording] = React.useState(false);
  const [showProcessing, setShowProcessing] = React.useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    setIsRecording(true);
    // Start recording logic here (use react-native-audio or similar)
    timerRef.current = setTimeout(stopRecording, 6000); // 6 seconds
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setShowProcessing(true);
    // Stop recording and get audio file path
    const audioFilePath = 'path/to/audio.mp3'; // Replace with actual path
    // Send to backend
    const formData = new FormData();
    formData.append('file', {
      uri: audioFilePath,
      type: 'audio/mp3',
      name: 'audio.mp3',
    } as any);
    await axios.post(`${backendUrl}/process_audio/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (onRecordingComplete) onRecordingComplete();
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity
        style={styles.micButton}
        onPress={startRecording}
        disabled={isRecording}
        accessibilityLabel="Start recording"
      >
        <Text style={{ fontSize: 30 }}>🎤</Text>
      </TouchableOpacity>
      {showProcessing && <AudioPlayer source="jarvis_processing.mp3" />}
    </View>
  );
};

const styles = StyleSheet.create({
  micButton: {
    backgroundColor: 'white',
    borderRadius: 9999,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default MicRecorder; 
*/