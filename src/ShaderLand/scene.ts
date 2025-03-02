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
    stripeColor: string;
    noiseScale: number;
    noiseStrength: number;
    waveSpeed: number;
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
      noiseScale: 1.0,
      noiseStrength: 0.5,
      waveSpeed: 0.5,
    };

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
        noiseScale: { value: this.params.noiseScale },
        noiseStrength: { value: this.params.noiseStrength },
        waveSpeed: { value: this.params.waveSpeed },
      },
      vertexShader: `
        uniform float time;
        uniform float noiseScale;
        uniform float noiseStrength;
        uniform float waveSpeed;
        
        varying vec3 vWorldPosition;
        varying float vDepth;

        // Classic Perlin 3D Noise by Stefan Gustavson
        vec4 permute(vec4 x) {
          return mod(((x*34.0)+1.0)*x, 289.0);
        }
        
        vec4 taylorInvSqrt(vec4 r) {
          return 1.79284291400159 - 0.85373472095314 * r;
        }
        
        vec3 fade(vec3 t) {
          return t*t*t*(t*(t*6.0-15.0)+10.0);
        }
        
        float noise(vec3 P) {
          vec3 Pi0 = floor(P);
          vec3 Pi1 = Pi0 + vec3(1.0);
          Pi0 = mod(Pi0, 289.0);
          Pi1 = mod(Pi1, 289.0);
          vec3 Pf0 = fract(P);
          vec3 Pf1 = Pf0 - vec3(1.0);
          vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
          vec4 iy = vec4(Pi0.yy, Pi1.yy);
          vec4 iz0 = Pi0.zzzz;
          vec4 iz1 = Pi1.zzzz;
        
          vec4 ixy = permute(permute(ix) + iy);
          vec4 ixy0 = permute(ixy + iz0);
          vec4 ixy1 = permute(ixy + iz1);
        
          vec4 gx0 = ixy0 / 7.0;
          vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
          gx0 = fract(gx0);
          vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
          vec4 sz0 = step(gz0, vec4(0.0));
          gx0 -= sz0 * (step(0.0, gx0) - 0.5);
          gy0 -= sz0 * (step(0.0, gy0) - 0.5);
        
          vec4 gx1 = ixy1 / 7.0;
          vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
          gx1 = fract(gx1);
          vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
          vec4 sz1 = step(gz1, vec4(0.0));
          gx1 -= sz1 * (step(0.0, gx1) - 0.5);
          gy1 -= sz1 * (step(0.0, gy1) - 0.5);
        
          vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
          vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
          vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
          vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
          vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
          vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
          vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
          vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
        
          vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
          g000 *= norm0.x;
          g010 *= norm0.y;
          g100 *= norm0.z;
          g110 *= norm0.w;
          vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
          g001 *= norm1.x;
          g011 *= norm1.y;
          g101 *= norm1.z;
          g111 *= norm1.w;
        
          float n000 = dot(g000, Pf0);
          float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
          float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
          float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
          float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
          float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
          float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
          float n111 = dot(g111, Pf1);
        
          vec3 fade_xyz = fade(Pf0);
          vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
          vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
          float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
          return 2.2 * n_xyz;
        }

        void main() {
            // Calculate noise based on position and time
            vec3 noiseInput = position * noiseScale + time * waveSpeed;
            float noiseValue = noise(noiseInput);
            
            // Apply noise displacement along the normal
            vec3 displaced = position + normal * noiseValue * noiseStrength;
            
            vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
            vec4 viewPosition = viewMatrix * worldPosition;
            vWorldPosition = worldPosition.xyz;
            
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
        
        varying vec3 vWorldPosition;
        varying float vDepth;
        
        void main() {
            // Use world space Y coordinate for consistent downward movement
            float animatedY = vWorldPosition.y + time * speed;
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

    const waveFolder = this.gui.addFolder("Wave Effect");
    waveFolder
      .add(this.params, "noiseScale", 0.1, 5.0, 0.1)
      .name("Wave Scale")
      .onChange(() => {
        this.stripeMaterial.uniforms.noiseScale.value = this.params.noiseScale;
      });
    waveFolder
      .add(this.params, "noiseStrength", 0.0, 2.0, 0.1)
      .name("Wave Strength")
      .onChange(() => {
        this.stripeMaterial.uniforms.noiseStrength.value =
          this.params.noiseStrength;
      });
    waveFolder
      .add(this.params, "waveSpeed", 0.0, 2.0, 0.1)
      .name("Wave Speed")
      .onChange(() => {
        this.stripeMaterial.uniforms.waveSpeed.value = this.params.waveSpeed;
      });
    waveFolder.open();

    const torusFolder = this.gui.addFolder("Torus");
    torusFolder
      .add(this.params, "torusRadius", 5, 20, 0.5)
      .name("Radius")
      .onChange(() => {
        const newGeometry = new THREE.TorusGeometry(
          this.params.torusRadius,
          this.params.tubeRadius,
          this.params.radialSegments,
          this.params.tubularSegments,
        );
        this.torus1.geometry.dispose();
        this.torus2.geometry.dispose();
        this.torus1.geometry = newGeometry;
        this.torus2.geometry = newGeometry.clone();

        // Update positions
        this.torus1.position.x = -this.params.torusRadius / 3;
        this.torus2.position.x = this.params.torusRadius / 3;
      });
    torusFolder
      .add(this.params, "tubeRadius", 1, 5, 0.1)
      .name("Tube Radius")
      .onChange(() => {
        const newGeometry = new THREE.TorusGeometry(
          this.params.torusRadius,
          this.params.tubeRadius,
          this.params.radialSegments,
          this.params.tubularSegments,
        );
        this.torus1.geometry.dispose();
        this.torus2.geometry.dispose();
        this.torus1.geometry = newGeometry;
        this.torus2.geometry = newGeometry.clone();
      });
    torusFolder
      .add(this.params, "radialSegments", 8, 32, 1)
      .name("Radial Segments")
      .onChange(() => {
        const newGeometry = new THREE.TorusGeometry(
          this.params.torusRadius,
          this.params.tubeRadius,
          this.params.radialSegments,
          this.params.tubularSegments,
        );
        this.torus1.geometry.dispose();
        this.torus2.geometry.dispose();
        this.torus1.geometry = newGeometry;
        this.torus2.geometry = newGeometry.clone();
      });
    torusFolder
      .add(this.params, "tubularSegments", 8, 32, 1)
      .name("Tubular Segments")
      .onChange(() => {
        const newGeometry = new THREE.TorusGeometry(
          this.params.torusRadius,
          this.params.tubeRadius,
          this.params.radialSegments,
          this.params.tubularSegments,
        );
        this.torus1.geometry.dispose();
        this.torus2.geometry.dispose();
        this.torus1.geometry = newGeometry;
        this.torus2.geometry = newGeometry.clone();
      });
    torusFolder.open();
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
