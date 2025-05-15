import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const GreetingInstruction = () => (
  <View style={styles.container}>
    <Text style={styles.subtext}>Hello, this is Jarvis</Text>
    <Text style={styles.query}>How can I make your day easier?</Text>
    <Text style={styles.note}>To stop please say:</Text>
    <Text style={styles.stopCommand}>"I am done TAVI"</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 30,
  },
  subtext: {
    fontSize: 16,
    color: '#333',
  },
  query: {
    fontSize: 20,
    color: '#135480',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 8,
  },
  note: {
    fontSize: 14,
    color: '#333',
  },
  stopCommand: {
    fontSize: 16,
    color: '#135480',
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default GreetingInstruction;
