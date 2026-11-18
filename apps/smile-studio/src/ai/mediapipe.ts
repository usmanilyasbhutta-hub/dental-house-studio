// Labs (Auto-detect beta): the ONLY file that touches @mediapipe/tasks-vision. Loaded lazily (never at app start).
// The wasm runtime and the models come from this app's own origin (public/models/, see scripts/models.mjs);
// nothing is fetched from any other host. The e2e suite swaps this module for a stub with fixed outputs.
import { FaceLandmarker, FilesetResolver, InteractiveSegmenterLegacy } from "@mediapipe/tasks-vision";

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

const base = () => new URL("models/", document.baseURI).href;

let fileset: Promise<WasmFileset> | null = null;
let face: Promise<FaceLandmarker> | null = null;
let seg: Promise<InteractiveSegmenterLegacy> | null = null;

const files = () => (fileset ??= FilesetResolver.forVisionTasks(base() + "wasm").catch((e) => ((fileset = null), Promise.reject(e))));

function faceTask() {
  face ??= files()
    .then((fs) =>
      FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: base() + "face_landmarker.task", delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      }),
    )
    .catch((e) => ((face = null), Promise.reject(e)));
  return face;
}

function segTask() {
  seg ??= files()
    .then((fs) =>
      InteractiveSegmenterLegacy.createFromOptions(fs, {
        baseOptions: { modelAssetPath: base() + "magic_touch.tflite", delegate: "CPU" },
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }),
    )
    .catch((e) => ((seg = null), Promise.reject(e)));
  return seg;
}

/** Face landmarks (normalised to the given image), or null when no face is found. */
export async function faceLandmarks(image: HTMLCanvasElement | ImageBitmap): Promise<{ x: number; y: number }[] | null> {
  const t = await faceTask();
  const r = t.detect(image);
  const f = r.faceLandmarks?.[0];
  return f && f.length ? f.map((p) => ({ x: p.x, y: p.y })) : null;
}

/**
 * Foreground confidence (0..1, w × h of the input image) of the object under a tap at (x, y), normalised to the image.
 * The data is copied before the MediaPipe result is released.
 */
export async function segmentAt(image: HTMLCanvasElement, x: number, y: number): Promise<{ data: Float32Array; w: number; h: number } | null> {
  const t = await segTask();
  const r = t.segment(image, { keypoint: { x, y } });
  try {
    const m = r.confidenceMasks?.[r.confidenceMasks.length - 1];
    if (!m) return null;
    return { data: new Float32Array(m.getAsFloat32Array()), w: m.width, h: m.height };
  } finally {
    r.close();
  }
}
