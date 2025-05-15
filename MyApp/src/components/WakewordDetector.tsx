/*import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
// Import Porcupine dependencies (assume installed)
// import { PorcupineManager } from '@picovoice/porcupine-react-native';

interface WakewordDetectorProps {
  onWakeword: () => void;
  porcupineKey: string;
}

const WakewordDetector: React.FC<WakewordDetectorProps> = ({ onWakeword, porcupineKey }) => {
  useEffect(() => {
    // Initialize Porcupine here and listen for wakeword
    // On detection, call onWakeword()
    // Cleanup on unmount
  }, [porcupineKey]);

  return (
    <View style={{ display: 'none' }}>{/* Hidden, background listener *//*}/*</View>
  );
};
/*export default WakewordDetector; */
