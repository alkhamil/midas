/**
 * Sensor pointer kustom: sama seperti PointerSensor dnd-kit, tetapi TANPA
 * penahan klik level-dokumen.
 *
 * Konteks: AbstractPointerSensor.handleStart() memasang listener capture
 * `click → stopPropagation` di document saat drag teraktivasi, lalu
 * melepasnya 50ms setelah drag end. Di app ini pelepasan tersebut tidak
 * pernah efektif — suppression macet selamanya dan SEMUA klik berhenti
 * merespons setelah drop pertama (verified: bubble 0/16, stack
 * menunjuk core.esm.js `stopPropagation`). UI kanvas sudah menjaga
 * klik-vs-drag sendiri (guard jarak pointer di palet + stopPropagation
 * di gagang kartu), sehingga suppression dnd-kit redundan dan aman
 * dibuang.
 */
import { PointerSensor as BasePointerSensor } from '@dnd-kit/core';

interface SensorCoordinates {
  x: number;
  y: number;
}

interface PointerSensorInternals {
  activated: boolean;
  initialCoordinates: SensorCoordinates | undefined;
  props: {
    onStart: (coordinates: SensorCoordinates) => void;
  };
  documentListeners: {
    add: (eventName: string, handler: () => void) => void;
  };
  removeTextSelection: () => void;
}

type HandleStartFn = (this: PointerSensorInternals) => void;

const handleStartWithoutClickSuppression: HandleStartFn = function (this) {
  const { initialCoordinates } = this;
  if (initialCoordinates) {
    this.activated = true;
    // Sengaja TIDAK memasang document click stopPropagation (lihat header).
    this.documentListeners.add('selectionchange', this.removeTextSelection);
    this.removeTextSelection();
    this.props.onStart(initialCoordinates);
  }
};

class CanvasPointerSensor extends BasePointerSensor {}

// `handleStart` bertipe private di dnd-kit — patch prototype saat runtime.
(CanvasPointerSensor.prototype as unknown as Record<'handleStart', HandleStartFn>).handleStart =
  handleStartWithoutClickSuppression;

export default CanvasPointerSensor;
