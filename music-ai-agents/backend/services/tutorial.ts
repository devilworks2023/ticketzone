import type { AnalysisResult } from '../../types';

function bpmFeel(bpm: number): string {
  if (bpm < 90) return 'un groove relajado, típico de hip-hop, downtempo o R&B';
  if (bpm < 115) return 'un tempo medio propio de house, disco o pop';
  if (bpm < 130) return 'un pulso enérgico de house/tech house';
  if (bpm < 145) return 'un tempo de techno o trance';
  if (bpm < 160) return 'un ritmo rápido cercano al drum & bass o hardstyle';
  return 'un tempo muy acelerado, propio de estilos extremos (DnB, hardcore)';
}

export function generateTutorial(analysis: Pick<AnalysisResult, 'bpm' | 'key' | 'instruments' | 'noteEvents' | 'drumHits'>): string {
  const { bpm, key, instruments, noteEvents, drumHits } = analysis;
  const topInstrument = instruments[0];

  const lines: string[] = [];

  lines.push(`Este track está en ${key.name} (Camelot ${key.camelot}) a ${bpm} BPM, ${bpmFeel(bpm)}.`);
  lines.push('');
  lines.push('1. Tonalidad y armonía');
  lines.push(`   - Construye tus acordes y bajo alrededor de ${key.tonic} ${key.mode === 'major' ? 'mayor' : 'menor'}.`);
  lines.push(`   - Usa el código Camelot ${key.camelot} para mezclar armónicamente con otros tracks compatibles (mismo número, o ±1 con la misma letra).`);
  lines.push('');
  lines.push('2. Tempo y groove');
  lines.push(`   - Programa tu secuenciador a ${bpm} BPM.`);
  if (drumHits.length > 0) {
    lines.push(`   - Se detectaron ${drumHits.length} eventos de percusión en el patrón; úsalos como referencia para programar tu batería (kick/snare/hi-hat).`);
  } else {
    lines.push('   - No se detectó percusión clara: prueba construyendo tu propio patrón rítmico a partir del tempo detectado.');
  }
  lines.push('');
  lines.push('3. Instrumentación detectada (estimación heurística por energía espectral)');
  for (const inst of instruments) {
    lines.push(`   - ${inst.label}: presencia ${Math.round(inst.presence * 100)}%`);
  }
  lines.push('');
  lines.push('4. Patrón MIDI generado');
  if (noteEvents.length > 0) {
    lines.push(`   - Se extrajeron ${noteEvents.length} notas de la línea dominante (bajo/melodía). Impórtalas en tu DAW para reconstruir el riff.`);
  } else {
    lines.push('   - No se detectó una línea melódica dominante clara; el MIDI incluye solo el patrón rítmico si existe.');
  }
  lines.push('');
  lines.push('5. Sugerencia de arreglo');
  lines.push(`   - Empieza con ${topInstrument.label.toLowerCase()} como elemento principal (mayor presencia detectada).`);
  lines.push('   - Añade capas progresivamente: introduce el bajo, luego percusión, luego elementos armónicos/pad para construir tensión.');
  lines.push('   - Usa el MIDI exportado como punto de partida y humaniza velocidades/timing para que suene menos mecánico.');

  return lines.join('\n');
}
