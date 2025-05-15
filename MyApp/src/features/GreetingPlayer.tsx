import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface GreetingTextProps {
  text: string;
}

const GreetingText: React.FC<GreetingTextProps> = ({ text }) => (
  <View style={styles.container}>
    <Text style={styles.title}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '300',
    color: '#121212',
    textAlign: 'center',
    marginTop: 100,
    fontFamily: 'Poppins-Regular',
  },
});

export default GreetingText;