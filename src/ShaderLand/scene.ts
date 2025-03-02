import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as dat from "dat.gui";

export class Scene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private gui!: dat.GUI;
  private stripeMaterial: THREE.ShaderMaterial = new THREE.ShaderMaterial();
  private torus1: THREE.Mesh = new THREE.Mesh();
  private torus2: THREE.Mesh = new THREE.Mesh();
  private torusGroup: THREE.Group = new THREE.Group();
  private params: {
    stripeWidth: number;
    stripeSpacing: number;
    animationSpeed: number;
    torusRadius: number;
    tubeRadius: number;
    radialSegments: number;
    tubularSegments: number;
  };

  constructor(container: HTMLDivElement) {
    // Initialize scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Disable anti-aliasing for a more pixelated look
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;

    // Initialize parameters
    this.params = {
      stripeWidth: 0.035,
      stripeSpacing: 0.5,
      animationSpeed: 0.35,
      torusRadius: 10,
      tubeRadius: 3,
      radialSegments: 16,
      tubularSegments: 16,
    };

    // Create GUI
    this.gui = new dat.GUI({
      name: "ShaderLand",
      autoPlace: true,
    });

    this.setupMaterial();
    this.setupMesh();
    this.setupGUI();
    this.setupLights();
    this.setupScene();
    this.animate();

    // Handle window resize
    window.addEventListener("resize", this.handleResize);
  }

  private setupMaterial(): void {
    this.stripeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        stripeWidth: { value: this.params.stripeWidth },
        stripeSpacing: { value: this.params.stripeSpacing },
        speed: { value: this.params.animationSpeed },
      },
      vertexShader: `
        varying vec4 vViewPosition;
        void main() {
            vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = modelViewPosition;
            gl_Position = projectionMatrix * modelViewPosition;
        }
      `,
      fragmentShader: `
        varying vec4 vViewPosition;
        uniform float stripeWidth;
        uniform float stripeSpacing;
        uniform float time;
        uniform float speed;
        
        void main() {
            float animatedY = vViewPosition.y + time * speed;
            float totalWidth = stripeWidth + stripeSpacing;
            float stripePattern = mod(animatedY, totalWidth);
            float line = step(0.0, stripePattern) - step(stripeWidth, stripePattern);
            
            vec3 lineColor = vec3(1.0);
            vec3 finalColor = mix(vec3(0.0), lineColor, line);
            float alpha = mix(0.95, 1.0, line);
            
            gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: true,
      depthTest: true,
    });
  }

  private setupMesh(): void {
    const geometry = new THREE.TorusGeometry(
      this.params.torusRadius,
      this.params.tubeRadius,
      this.params.radialSegments,
      this.params.tubularSegments,
    );

    // Create two toruses with the same geometry and material
    this.torus1 = new THREE.Mesh(geometry, this.stripeMaterial);
    this.torus2 = new THREE.Mesh(geometry.clone(), this.stripeMaterial);

    // Position first torus slightly left of center (reduced from /2 to /3)
    this.torus1.position.x = -this.params.torusRadius / 3;

    // Position and rotate second torus
    this.torus2.rotation.x = Math.PI / 1.8;
    this.torus2.rotation.z = Math.PI / 1.2;
    this.torus2.position.x = this.params.torusRadius / 3; // reduced from /2 to /3

    // Clear any existing children from the group
    this.torusGroup.clear();

    // Add toruses to the group
    this.torusGroup.add(this.torus1);
    this.torusGroup.add(this.torus2);

    // Rotate the entire group towards the user (around the X axis)
    this.torusGroup.rotation.x = THREE.MathUtils.degToRad(20);

    this.scene.add(this.torusGroup);
  }

  private setupGUI(): void {
    const shaderFolder = this.gui.addFolder("Shader Parameters");
    shaderFolder
      .add(this.params, "stripeWidth", 0.01, 0.5, 0.01)
      .name("Stripe Width")
      .onChange(() => {
        this.stripeMaterial.uniforms.stripeWidth.value =
          this.params.stripeWidth;
        this.stripeMaterial.needsUpdate = true;
      });
    shaderFolder
      .add(this.params, "stripeSpacing", 0.1, 2.0, 0.1)
      .name("Stripe Spacing")
      .onChange(() => {
        this.stripeMaterial.uniforms.stripeSpacing.value =
          this.params.stripeSpacing;
        this.stripeMaterial.needsUpdate = true;
      });
    shaderFolder
      .add(this.params, "animationSpeed", 0.1, 2.0, 0.1)
      .onChange(() => {
        this.stripeMaterial.uniforms.speed.value = this.params.animationSpeed;
        this.stripeMaterial.needsUpdate = true;
      });
    shaderFolder.open();

    const geometryFolder = this.gui.addFolder("Torus Geometry");

    const updateGeometry = () => {
      const newGeometry = new THREE.TorusGeometry(
        this.params.torusRadius,
        this.params.tubeRadius,
        this.params.radialSegments,
        this.params.tubularSegments,
      );

      // Update both toruses
      this.torus1.geometry.dispose();
      this.torus2.geometry.dispose();
      this.torus1.geometry = newGeometry;
      this.torus2.geometry = newGeometry.clone();

      // Maintain closer positioning
      this.torus1.position.x = -this.params.torusRadius / 3;
      this.torus2.position.x = this.params.torusRadius / 3;
    };

    geometryFolder
      .add(this.params, "torusRadius", 5, 20, 0.5)
      .onChange(updateGeometry);
    geometryFolder
      .add(this.params, "tubeRadius", 0.5, 6, 0.1)
      .onChange(updateGeometry);
    geometryFolder.open();
  }

  private setupLights(): void {
    const pointLight = new THREE.PointLight(0xffffff);
    pointLight.position.set(5, 5, 5);
    const ambientLight = new THREE.AmbientLight(0xffffff);
    this.scene.add(pointLight, ambientLight);
  }

  private setupScene(): void {
    this.camera.position.z = 30;
    this.scene.background = new THREE.Color(0x000000);
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.stripeMaterial.uniforms.time.value += 0.01;
    // Example of rotating the entire group:
    this.torusGroup.rotation.x -= 0.001;
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    console.log("DISPOSE");
    window.removeEventListener("resize", this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.gui.destroy();
    this.torus1.geometry.dispose();
    this.torus2.geometry.dispose();
    (this.torus1.material as THREE.Material).dispose();
    this.torusGroup.clear();
  }
}
