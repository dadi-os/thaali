import { type ReactNode, Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useThemeTokens } from "../hooks/useThemeTokens";

export type GraphSpaceProps = {
  /** When true, enable orbit / zoom / pan. */
  interactive: boolean;
  /** Take pointer hover and clicks on scene objects even without orbit (e.g. a home tile). */
  pickable?: boolean;
  className?: string;
  children: ReactNode;
  /** Camera position at mount. */
  cameraPosition?: [number, number, number];
  /** Far plane for large graphs. */
  cameraFar?: number;
  /** Click that hit nothing in the scene (a drag to orbit does not count). */
  onBackgroundClick?: () => void;
};

/**
 * Shared R3F shell for graph spaces: a transparent canvas over the page background,
 * fog in the page's `--bone` color (so the far side fades into the page in either
 * theme), lights, and orbit controls when interactive. Children own camera framing
 * and set the fog range each frame.
 *
 * Unmount shrinks the canvas to 1x1 so WebKit frees its full-window antialiased drawing
 * buffers right away: R3F only force-loses the context, a lost WebKit context keeps its
 * buffers until the canvas is garbage-collected, and every page entrance remounts this.
 * It waits for the canvas to leave the DOM, so StrictMode's simulated unmount keeps it.
 */
export function GraphSpace({
  interactive,
  pickable = false,
  className,
  children,
  cameraPosition = [0, 70, 140],
  cameraFar = 4000,
  onBackgroundClick,
}: GraphSpaceProps) {
  const { "--bone": bone } = useThemeTokens(["--bone"]);
  const glRef = useRef<THREE.WebGLRenderer>(null);
  useEffect(
    () => () => {
      const gl = glRef.current;
      if (gl && !gl.domElement.isConnected) {
        gl.setSize(1, 1, false);
      }
    },
    [],
  );
  const rootClass = [
    "relative h-full min-h-0 w-full",
    interactive || pickable ? "" : "pointer-events-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={rootClass}>
      <Canvas
        className="h-full w-full touch-none"
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        camera={{
          position: cameraPosition,
          fov: 40,
          near: 0.5,
          far: cameraFar,
        }}
        style={{ background: "transparent" }}
        onPointerMissed={onBackgroundClick}
        onCreated={({ gl }) => {
          glRef.current = gl;
        }}
      >
        <fog attach="fog" args={[bone, 80, 520]} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[50, 90, 40]} intensity={0.7} />
        <directionalLight position={[-40, 30, -50]} intensity={0.28} />
        <hemisphereLight args={["#fafaf7", "#b9c9ab", 0.35]} />
        <Suspense fallback={null}>{children}</Suspense>
        {interactive ? (
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={20}
            maxDistance={1100}
          />
        ) : null}
      </Canvas>
    </div>
  );
}
