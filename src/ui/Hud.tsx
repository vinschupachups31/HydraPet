import { Pressable, StyleSheet, Text, View } from 'react-native';
import { debugStore, useDebug } from '../pet/debugStore';
import { ACTIVE_MODEL } from '../pet/models';
import { useView, viewStore } from '../pet/viewStore';

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
  const view = useView();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {view.info && <View style={styles.top} pointerEvents="none">
        <Text style={styles.title}>HydraPet · test technique</Text>
        <Text style={styles.line}>{d.loaded ? 'Modèle chargé' : 'Chargement du modèle…'} · {d.fps} fps</Text>
        <Text style={styles.line}>état {d.state}{d.phaseName !== '-' ? ` / ${d.phaseName}` : ''}{d.remaining > 0 ? ` (${d.remaining.toFixed(1)} s)` : ''} · {d.poi} · zone {d.zone}</Text>
        <Text style={styles.line}>posture {d.postureState} · en attente : {d.pending} · mode {d.mode} ×{d.simSpeed}</Text>
        <Text style={styles.line}>vitesse demandée {d.speedRequested.toFixed(2)} · réelle {d.speedReal.toFixed(2)} m/s · {d.phase}</Text>
        <Text style={styles.line}>clip {d.clip} · repos {(d.idleW * 100).toFixed(0)}% marche {(d.walkW * 100).toFixed(0)}% (×{d.walkRate.toFixed(2)}) course {(d.runW * 100).toFixed(0)}%</Text>
        <Text style={styles.line}>appuis {d.feet} · ω {(d.omega * 57.3).toFixed(0)}°/s · tête {(d.gaze * 57.3).toFixed(0)}° · pieds tenus {d.anchors}{d.groomGap > 0 ? ` · patte↔museau ${d.groomGap.toFixed(1)} cm` : ''}</Text>
        <Text style={styles.small}>approche dans {d.nextApproachIn.toFixed(0)} s · trajets d'affilée {d.tripsInRow}</Text>
      </View>}
      {view.info && <Text style={styles.credits} pointerEvents="none">{ACTIVE_MODEL.credits}</Text>}
      <View style={styles.bottom}>
        <Btn testID="btn-call" label="Appeler" onPress={() => debugStore.commands.call?.()} />
        <Btn testID="btn-gait" label={`Allure : ${d.gait}`} onPress={() => debugStore.commands.toggleGait?.()} />
        <Btn testID="btn-auto" label={`Autonomie : ${d.autonomy ? 'oui' : 'non'}`} onPress={() => debugStore.commands.toggleAutonomy?.()} />
      </View>
      {view.info && (
        <View style={styles.acts}>
          <Btn testID="btn-observe" label="Observer" onPress={() => debugStore.commands.force?.('observe')} />
          <Btn testID="btn-sit" label="Assis" onPress={() => debugStore.commands.force?.('sit')} />
          <Btn testID="btn-groom" label="Toilette" onPress={() => debugStore.commands.force?.('groom')} />
          <Btn testID="btn-sleep" label="Sommeil" onPress={() => debugStore.commands.force?.('sleep')} />
          <Btn testID="btn-stretch" label="Étirement" onPress={() => debugStore.commands.force?.('stretch')} />
        </View>
      )}
      {view.info && (
        <View style={styles.acts2}>
          <Btn testID="btn-mode" label={`Mode : ${d.mode === 'demo' ? 'démo' : 'prod.'}`} onPress={() => debugStore.commands.toggleMode?.()} />
          <Btn testID="btn-speed" label={`Vitesse ×${d.simSpeed}`} onPress={() => debugStore.commands.setSpeed?.(d.simSpeed >= 4 ? 1 : d.simSpeed * 2)} />
          <Btn testID="btn-touch" label="Caresser" onPress={() => debugStore.commands.touch?.()} />
        </View>
      )}
      <View style={styles.dev}>
        <Btn testID="btn-info" label={`Infos : ${view.info ? 'oui' : 'non'}`} onPress={() => viewStore.set({ info: !view.info })} />
        <Btn testID="btn-ik" label={`Appuis IK : ${d.ik ? 'oui' : 'non'}`} onPress={() => debugStore.commands.toggleIK?.()} />
        <Btn testID="btn-overlay" label={`Superposition : ${view.overlay ? 'oui' : 'non'}`} onPress={() => viewStore.set({ overlay: !view.overlay })} />
        <Btn testID="btn-side" label={`Profil : ${view.devSide ? 'oui' : 'non'}`} onPress={() => viewStore.set({ devSide: !view.devSide, devClose: false })} />
        <Btn testID="btn-close" label={`Gros plan : ${view.devClose ? 'oui' : 'non'}`} onPress={() => viewStore.set({ devClose: !view.devClose, devSide: false })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { margin: 12, marginTop: 44, padding: 12, borderRadius: 16, backgroundColor: 'rgba(247,243,236,0.86)', borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start', maxWidth: '68%' },
  title: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  line: { color: C.text, fontSize: 13, lineHeight: 18 },
  small: { color: C.muted, fontSize: 11, marginTop: 4 },
  credits: { position: 'absolute', left: 12, right: 12, bottom: 260, color: C.muted, fontSize: 10, lineHeight: 13 },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 24, flexDirection: 'row', gap: 8 },
  acts: { position: 'absolute', left: 12, right: 12, bottom: 140, flexDirection: 'row', gap: 6 },
  acts2: { position: 'absolute', left: 12, right: 12, bottom: 198, flexDirection: 'row', gap: 6 },
  dev: { position: 'absolute', left: 12, right: 12, bottom: 82, flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: 48, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  btnText: { color: C.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
