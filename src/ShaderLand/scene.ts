import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import * as dat from "dat.gui";

export class Scene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
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
    stripeColor: string;
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
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
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // Initialize parameters
    this.params = {
      stripeWidth: 0.035,
      stripeSpacing: 0.5,
      animationSpeed: 0.35,
      torusRadius: 10,
      tubeRadius: 3,
      radialSegments: 16,
      tubularSegments: 16,
      stripeColor: "#ffffff",
      bloomStrength: 1.5,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
    };

    // Setup post-processing
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Add bloom pass
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85,
    );
    this.composer.addPass(this.bloomPass);

    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;

    // Create GUI
    this.gui = new dat.GUI({
      name: "ShaderLand",
      autoPlace: true,
    });

    this.setupMaterial();
    this.setupMesh();
    this.setupGUI();
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
        stripeColor: { value: new THREE.Color(this.params.stripeColor) },
      },
      vertexShader: `
        varying vec3 vViewPosition;
        varying float vDepth;

        void main() {
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);
            vec4 viewPosition = viewMatrix * modelPosition;
            vViewPosition = viewPosition.xyz;
            
            // Calculate normalized depth (0 = near, 1 = far)
            vDepth = (-viewPosition.z - 20.0) / 20.0;
            vDepth = clamp(vDepth, 0.0, 1.0);
            
            gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 stripeColor;
        uniform float stripeWidth;
        uniform float stripeSpacing;
        uniform float time;
        uniform float speed;
        
        varying vec3 vViewPosition;
        varying float vDepth;
        
        void main() {
            // Use view space Y coordinate for consistent downward movement
            float animatedY = -vViewPosition.y + time * speed;
            float totalWidth = stripeWidth + stripeSpacing;
            float stripePattern = mod(animatedY, totalWidth);
            float line = step(0.0, stripePattern) - step(stripeWidth, stripePattern);
            
            // Darken colors based on depth
            float depthFactor = 1.0 - (vDepth * 0.98);
            vec3 finalColor = mix(vec3(0.0), stripeColor * depthFactor, line);
            gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: false,
      side: THREE.FrontSide,
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

    // Position first torus slightly left of center
    this.torus1.position.x = -this.params.torusRadius / 3;

    // Position and rotate second torus
    this.torus2.rotation.x = Math.PI / 1.8;
    this.torus2.rotation.z = Math.PI / 1.2;
    this.torus2.position.x = this.params.torusRadius / 3;

    // Clear any existing children from the group
    this.torusGroup.clear();

    // Add toruses to the group
    this.torusGroup.add(this.torus1);
    this.torusGroup.add(this.torus2);

    // Rotate the entire group towards the user
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
      });
    shaderFolder
      .add(this.params, "stripeSpacing", 0.1, 2.0, 0.1)
      .name("Stripe Spacing")
      .onChange(() => {
        this.stripeMaterial.uniforms.stripeSpacing.value =
          this.params.stripeSpacing;
      });
    shaderFolder
      .add(this.params, "animationSpeed", 0.1, 2.0, 0.1)
      .onChange(() => {
        this.stripeMaterial.uniforms.speed.value = this.params.animationSpeed;
      });
    shaderFolder.open();

    const materialFolder = this.gui.addFolder("Material");
    materialFolder
      .addColor(this.params, "stripeColor")
      .name("Stripe Color")
      .onChange(() => {
        this.stripeMaterial.uniforms.stripeColor.value.set(
          this.params.stripeColor,
        );
      });
    materialFolder.open();

    const bloomFolder = this.gui.addFolder("Bloom");
    bloomFolder
      .add(this.params, "bloomStrength", 0.0, 3.0, 0.05)
      .name("Strength")
      .onChange(() => {
        this.bloomPass.strength = this.params.bloomStrength;
      });
    bloomFolder
      .add(this.params, "bloomRadius", 0.0, 1.0, 0.01)
      .name("Radius")
      .onChange(() => {
        this.bloomPass.radius = this.params.bloomRadius;
      });
    bloomFolder
      .add(this.params, "bloomThreshold", 0.0, 1.0, 0.05)
      .name("Threshold")
      .onChange(() => {
        this.bloomPass.threshold = this.params.bloomThreshold;
      });
    bloomFolder.open();
  }

  private setupScene(): void {
    this.camera.position.z = 30;
    this.scene.background = new THREE.Color(0x000000);
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  };

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.stripeMaterial.uniforms.time.value += 0.01;
    this.torusGroup.rotation.x -= 0.001;
    this.composer.render();
  };

  public dispose(): void {
    console.log("DISPOSE");
    window.removeEventListener("resize", this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.composer.dispose();
    this.gui.destroy();
    this.torus1.geometry.dispose();
    this.torus2.geometry.dispose();
    (this.torus1.material as THREE.Material).dispose();
    this.torusGroup.clear();
  }
}
