import { Pressable, StyleSheet, Text, View } from 'react-native';
import { debugStore, useDebug } from '../pet/debugStore';
import { ACTIVE_MODEL } from '../pet/models';

const C = { bg: '#F7F3EC', text: '#26352D', muted: '#6C786F', sage: '#749B83', water: '#76B8CC', border: '#E3E7DF' };

function Btn({ label, onPress, testID }: { label: string; onPress?: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export function Hud() {
  const d = useDebug();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.top} pointerEvents="none">
        <Text style={styles.title}>HydraPet · test technique</Text>
        <Text style={styles.line}>{d.loaded ? 'Modèle chargé' : 'Chargement du modèle…'} · {d.fps} fps</Text>
        <Text style={styles.line}>état {d.mode}{d.pivoting ? ' (pivote)' : ''} · {d.speed.toFixed(2)} m/s · allure {d.gait}</Text>
        <Text style={styles.line}>repos {(d.idleW * 100).toFixed(0)}% · marche {(d.walkW * 100).toFixed(0)}% (×{d.walkTS.toFixed(2)}) · course {(d.runW * 100).toFixed(0)}% (×{d.runTS.toFixed(2)})</Text>
        <Text style={styles.small}>{d.clips}</Text>
      </View>
      <Text style={styles.credits} pointerEvents="none">{ACTIVE_MODEL.credits}</Text>
      <View style={styles.bottom}>
        <Btn testID="btn-call" label="Appeler" onPress={() => debugStore.commands.call?.()} />
        <Btn testID="btn-gait" label={`Allure : ${d.gait}`} onPress={() => debugStore.commands.toggleGait?.()} />
        <Btn testID="btn-auto" label={`Autonomie : ${d.autonomy ? 'oui' : 'non'}`} onPress={() => debugStore.commands.toggleAutonomy?.()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { margin: 12, marginTop: 44, padding: 12, borderRadius: 16, backgroundColor: 'rgba(247,243,236,0.86)', borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start', maxWidth: '94%' },
  title: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  line: { color: C.text, fontSize: 13, lineHeight: 18 },
  small: { color: C.muted, fontSize: 11, marginTop: 4 },
  credits: { position: 'absolute', left: 12, right: 12, bottom: 82, color: C.muted, fontSize: 10, lineHeight: 13 },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 24, flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: 48, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  btnText: { color: C.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
