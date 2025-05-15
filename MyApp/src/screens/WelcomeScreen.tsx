import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import AudioManager from '../utils/AudioManager';
import GreetingText from '../features/GreetingPlayer';
import GreetingInstruction from '../features/GreetingInstruction';
import FooterNote from '../features/FooterNote';

const greetings = [
  { text: 'Welcome to Tavi', key: 'welcome' as const },
  { text: 'Hello, this is Jarvis', key: 'jarvisGreeting' as const },
  { text: 'Say Jarvis to get started', key: 'getstarted' as const },
];

const WelcomeScreen = () => {
  const [currentText, setCurrentText] = useState(greetings[0].text);

  useEffect(() => {
    AudioManager.preloadAll(); // preload all audio assets

    const timeout = setTimeout(() => {
      let currentIndex = 0;

      const playNext = () => {
        if (currentIndex < greetings.length) {
          const { key, text } = greetings[currentIndex];
          setCurrentText(text);
          currentIndex++;

          AudioManager.play(key, () => {
            setTimeout(playNext, 500);
          });
        }
      };

      playNext();
    }, 500); // wait for UI to settle

    return () => clearTimeout(timeout);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.inner}>
        <GreetingText text={currentText} />
       {/*  <GreetingInstruction />
        <FooterNote />*/}
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
});

export default WelcomeScreen;