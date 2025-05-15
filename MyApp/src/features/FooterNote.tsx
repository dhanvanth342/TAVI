import React from 'react';
import { Text, StyleSheet } from 'react-native';

const FooterNote = () => (
  <Text style={styles.footerNote}>
    Please ask one question at a time{'\n'}to get accurate assistance
  </Text>
);

const styles = StyleSheet.create({
  footerNote: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
    marginBottom: 20,
  },
});

export default FooterNote;
