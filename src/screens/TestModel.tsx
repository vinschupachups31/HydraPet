import { useEffect } from 'react';
import { PetCanvas } from '../scene/PetCanvas';
import { diag } from '../diag/diagStore';
import { RegisteredModel } from '../pet/models';

interface Props { model: RegisteredModel; label: string; shadows: boolean }

/** Tests 2-4 : charge le modèle et affiche la scène ; signale un blocage si rien n'arrive en 20 s. */
export function TestModel({ model, label, shadows }: Props) {
  useEffect(() => {
    diag.step('model', 'run', `Chargement du modèle (${label})…`);
    const timer = setTimeout(() => {
      const m = diag.get().find((l) => l.id === 'model');
      if (m && m.status === 'run') diag.step('model', 'fail', `Aucun résultat après 20 s : le chargement du modèle (${label}) semble bloqué`);
    }, 20000);
    return () => clearTimeout(timer);
  }, [label]);
  return <PetCanvas model={model} shadows={shadows} />;
}
