import React from 'react';
import { View, Text, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export default function OnboardingScreen() {
  const nav = useNavigation();
  const onContinue = async () => {
    await AsyncStorage.setItem('onboarded_v1', '1');
    // izin akışlarını eklediğinde (location/notifications) burada tetikle
    // sonra Login'e geç
    // @ts-ignore (stack türleri basit tutmak için)
    nav.replace('Login');
  };

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24, gap:12 }}>
      <Text style={{ fontSize:24, fontWeight:'700' }}>Cravus</Text>
      <Text style={{ textAlign:'center', color:'#666' }}>Map-first off-peak deals + River.</Text>
      <Button title="Continue" onPress={onContinue} />
    </View>
  );
}