import React, { useRef, useState, useEffect } from 'react';
import { View, Modal, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

interface VideoRecorderProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (videoFile: string) => void;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ visible, onClose, onVideoRecorded }) => {
  const camera = useRef<Camera>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'back');

  // Check camera permissions
  const requestCameraPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs access to your camera to record videos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermissions(hasPermission);
        setPermissionStatus(hasPermission ? 'granted' : 'denied');
        
        if (hasPermission) {
          console.log('Camera permission granted');
        } else {
          console.log('Camera permission denied');
        }
        
        return hasPermission;
      } else {
        // For iOS, you might want to use react-native-permissions
        // For now, assume granted on iOS
        setHasPermissions(true);
        setPermissionStatus('granted');
        console.log('Camera permission assumed granted for iOS');
        return true;
      }
    } catch (err) {
      console.error('Error requesting camera permissions:', err);
      setHasPermissions(false);
      setPermissionStatus('denied');
      return false;
    }
  };

  useEffect(() => {
    if (visible) {
      // Reset states when modal opens
      setIsCameraReady(false);
      setPermissionStatus('checking');
      requestCameraPermissions();
    } else {
      // Reset states when modal closes
      setIsRecording(false);
      setIsCameraReady(false);
      setHasPermissions(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [visible]);

  const handleCameraReady = () => {
    setIsCameraReady(true);
    console.log('Camera initialized and ready');
  };

  const canStartRecording = () => {
    const conditions = {
      hasPermissions,
      isCameraReady,
      deviceAvailable: !!device,
      cameraRefReady: !!camera.current,
      notRecording: !isRecording
    };

    const allConditionsMet = Object.values(conditions).every(condition => condition);

    if (!allConditionsMet) {
      console.log('Recording conditions not met:', conditions);
      
      if (!hasPermissions) {
        console.log('❌ Camera permissions not granted');
      }
      if (!isCameraReady) {
        console.log('❌ Camera not initialized');
      }
      if (!device) {
        console.log('❌ Camera device not available');
      }
      if (!camera.current) {
        console.log('❌ Camera component not mounted properly');
      }
      if (isRecording) {
        console.log('❌ Already recording');
      }
    } else {
      console.log('✅ All conditions met for recording');
    }

    return allConditionsMet;
  };

  const startRecording = async () => {
    if (!canStartRecording()) {
      console.log('Cannot start recording - prerequisites not met');
      return;
    }

    console.log('Starting video recording...');
    setIsRecording(true);

    try {
      camera.current!.startRecording({
        flash: 'off',
        videoCodec: 'h264',
        fileType: 'mp4',
        onRecordingFinished: async (video) => {
          console.log('Video recording finished:', video.path);
          console.log('Video file info:', {
            path: video.path,
            duration: video.duration
          });
          
          setIsRecording(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          const videoPath = Platform.OS === 'android' ? video.path : `file://${video.path}`;
          console.log('Sending video path to handler:', videoPath);
          
          onVideoRecorded(videoPath);
          onClose();
        },
        onRecordingError: (error) => {
          console.error('Video recording error:', error);
          setIsRecording(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          onClose();
        },
      });

      // Stop after 5 seconds
      timeoutRef.current = setTimeout(() => {
        console.log('Auto-stopping recording after 5 seconds');
        if (camera.current) {
          camera.current.stopRecording();
        }
      }, 5000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsRecording(false);
    }
  };

  const forceStop = () => {
    console.log('Force stopping recording');
    if (camera.current && isRecording) {
      camera.current.stopRecording();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsRecording(false);
    onClose();
  };

  const renderContent = () => {
    if (permissionStatus === 'checking') {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.statusText}>Checking camera permissions...</Text>
        </View>
      );
    }

    if (permissionStatus === 'denied') {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Camera permission denied</Text>
          <TouchableOpacity style={styles.retryButton} onPress={requestCameraPermissions}>
            <Text style={styles.retryText}>Request Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!device) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No camera device available</Text>
        </View>
      );
    }

    return (
      <>
        <Camera
          ref={camera}
          style={styles.camera}
          device={device}
          isActive={visible && hasPermissions}
          video={true}
          audio={true}
          onInitialized={handleCameraReady}
        />
        <View style={styles.bottomBar}>
          {!isRecording && isCameraReady && hasPermissions && (
            <TouchableOpacity 
              style={styles.recordButton} 
              onPress={startRecording}
            >
              <Text style={styles.recordText}>Start Recording</Text>
            </TouchableOpacity>
          )}
          
          {!isRecording && (!isCameraReady || !hasPermissions) && (
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="small" color="#1976d2" />
              <Text style={styles.waitingText}>
                {!hasPermissions ? 'Waiting for permissions...' : 'Initializing camera...'}
              </Text>
            </View>
          )}
          
          {isRecording && <Text style={styles.status}>Recording...</Text>}
          
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={forceStop}
          >
            <Text style={{ color: '#fff' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {renderContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20 
  },
  bottomBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    padding: 24, 
    alignItems: 'center' 
  },
  recordButton: { 
    backgroundColor: '#1976d2', 
    padding: 16, 
    borderRadius: 24 
  },
  closeButton: { 
    backgroundColor: '#b71c1c', 
    padding: 12, 
    borderRadius: 16 
  },
  recordText: { 
    color: '#fff', 
    fontWeight: 'bold' 
  },
  status: { 
    color: '#fff', 
    fontSize: 16 
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center'
  },
  errorText: {
    color: '#ff5252',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20
  },
  retryButton: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 8
  },
  retryText: {
    color: '#fff',
    fontSize: 14
  },
  waitingContainer: {
    alignItems: 'center'
  },
  waitingText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5
  }
});

export default VideoRecorder;
