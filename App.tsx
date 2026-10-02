import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { PetCanvas } from './src/scene/PetCanvas';
import { Hud } from './src/ui/Hud';

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F3EC' }}>
      <PetCanvas />
      <Hud />
      <StatusBar style="dark" />
    </View>
  );
}
