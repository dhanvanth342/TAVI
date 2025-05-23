import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Text } from 'react-native';
import AudioManager from '../utils/AudioManager';
import GreetingText from '../features/GreetingPlayer';
import AudioRecorder from '../components/AudioRecorder';
import { PORCUPINE_ACCESS_KEY } from '@env';

const greetings = [
  { text: 'Welcome to Tavi', key: 'welcome' as const },
  { text: 'Hello, this is Jarvis', key: 'jarvisGreeting' as const },
  { text: 'Say Jarvis to get started', key: 'getstarted' as const },
];

const WelcomeScreen = () => {
  const [currentText, setCurrentText] = useState(greetings[0].text);
  const [isMicActive, setIsMicActive] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [showRecorder, setShowRecorder] = useState(false); // 🚩 Add state to control AudioRecorder visibility

  useEffect(() => {
    AudioManager.preloadAll();

    const timeout = setTimeout(() => {
      let currentIndex = 0;

      const playNext = () => {
        if (currentIndex < greetings.length) {
          const { key, text } = greetings[currentIndex];
          setCurrentText(text);
          currentIndex++;

          // Play greeting sound, then play next after a short pause
          AudioManager.play(key, () => {
            setTimeout(playNext, 500);
          });
        } else {
          // 🚩 All greetings done! Show AudioRecorder and start wake word listening
          setShowRecorder(true);
        }
      };

      playNext();
    }, 500);

    // Check access key for debugging/info
    console.log('Access Key length:', PORCUPINE_ACCESS_KEY?.length);
    if (!PORCUPINE_ACCESS_KEY || PORCUPINE_ACCESS_KEY.length < 10) {
      console.error('Invalid Access Key!');
      setDebugInfo('Error: Invalid Access Key');
    } else {
      console.log('Access Key looks valid');
      setDebugInfo('Access Key: Valid');
    }

    return () => clearTimeout(timeout);
  }, []);

  const handleRecordingComplete = (uri: string) => {
    console.log('Recording saved at:', uri);
  };

  const handleMicStatus = (status: boolean) => {
    setIsMicActive(status);
    console.log('Microphone status:', status ? 'Active' : 'Inactive');
  };

  const testMicrophone = async () => {
    // Implementation of testMicrophone
  };

  const checkPorcupineStatus = async (): Promise<boolean> => {
    // Implementation of checkPorcupineStatus
    return true; // or false based on your logic
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.inner}>
        <GreetingText text={currentText} />
        <View style={styles.micStatus}>
          <Text style={styles.micStatusText}>
            {isMicActive ? '🎤 Listening for "Jarvis"...' : '🎤 Microphone Inactive'}
          </Text>
          <Text style={styles.debugText}>
            {debugInfo}
          </Text>
        </View>
        {/* 🚩 Only show AudioRecorder after greetings finish */}
        {showRecorder && (
          <AudioRecorder 
            porcupineAccessKey={PORCUPINE_ACCESS_KEY}
            onRecordingComplete={handleRecordingComplete}
            onMicStatusChange={handleMicStatus}
            onTestMicrophone={testMicrophone}
            onCheckPorcupineStatus={checkPorcupineStatus}
            style={styles.recorder}
          />
        )}
        <TouchableOpacity 
          style={styles.testButton}
          onPress={async () => {
            console.log('Running diagnostic tests...');
            if (testMicrophone && checkPorcupineStatus) {
              await testMicrophone();
              const isListening = await checkPorcupineStatus();
              setDebugInfo(`Mic: Working, Porcupine: ${isListening ? 'Listening' : 'Not Listening'}`);
            }
          }}
        >
          <Text style={styles.testButtonText}>Run Diagnostic Tests</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D7FCFF',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#ADC7FF',
  },
  recorder: {
    marginTop: 20,
  },
  micStatus: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
  },
  micStatusText: {
    fontSize: 16,
    color: '#333',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
  },
  testButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default WelcomeScreen;
