import { useEffect, useRef } from "react";
import { Scene } from "./scene";

export function ShaderLand() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (!mounted.current) {
      sceneRef.current = new Scene(canvasRef.current);
      mounted.current = true;
    }

    return () => {
      if (sceneRef.current) {
        // sceneRef.current.dispose();
      }
    };
  }, []);

  return <div ref={canvasRef}></div>;
}
