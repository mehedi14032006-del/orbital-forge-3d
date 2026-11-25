import * as THREE from 'three';

/**
 * Custom GLSL Atmospheric Fresnel Glow Shader
 */
export function createAtmosphereMaterial(color = 0x38bdf8) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
        float pulse = 0.88 + 0.12 * sin(uTime * 1.4);
        gl_FragColor = vec4(uColor * 1.45, fresnel * 0.55 * pulse);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide
  });
}

/**
 * Custom GLSL Energy Shield Dome Shader with Animated Scanlines & Hit Flash
 */
export function createShieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHit: { value: 0 },
      uColor: { value: new THREE.Color(0x38bdf8) },
      uHitColor: { value: new THREE.Color(0xf43f5e) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHit;
      uniform vec3 uColor;
      uniform vec3 uHitColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        float rim = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.4);
        float scan = 0.5 + 0.5 * sin(vLocalPos.y * 12.0 - uTime * 5.0);
        vec3 col = mix(uColor, uHitColor, uHit);
        float alpha = clamp(rim * 0.52 + scan * 0.08 + uHit * 0.35, 0.0, 0.85);
        gl_FragColor = vec4(col * (1.2 + uHit * 1.2), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

/**
 * Custom GLSL Volumetric Rocket Thruster Exhaust Plume
 */
export function createThrusterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float flicker = 0.8 + 0.2 * sin(uTime * 48.0 + vUv.y * 16.0);
        vec3 core = vec3(1.0, 0.95, 0.8);
        vec3 mid = vec3(0.22, 0.78, 1.0);
        vec3 col = mix(mid, core, smoothstep(0.15, 0.95, vUv.y));
        float alpha = smoothstep(0.0, 0.75, vUv.y) * flicker;
        gl_FragColor = vec4(col * 1.8, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}
