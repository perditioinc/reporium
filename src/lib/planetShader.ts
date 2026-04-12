import * as THREE from 'three';

export const PLANET_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  void main() {
    vNormal    = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir   = normalize(-mvPos.xyz);
    vLocalPos  = position;
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const PLANET_FRAG = /* glsl */`
  uniform vec3  uC1;
  uniform vec3  uC2;
  uniform vec3  uC3;
  uniform float uSeed;
  uniform float uTime;
  uniform float uEmissive;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0 + i.z * 113.0;
    return mix(
      mix(mix(hash(n),      hash(n+1.0),   f.x),
          mix(hash(n+57.0), hash(n+58.0),  f.x), f.y),
      mix(mix(hash(n+113.0),hash(n+114.0), f.x),
          mix(hash(n+170.0),hash(n+171.0), f.x), f.y), f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise3(p); p = p * 2.01 + 0.5; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    vec3 p  = vLocalPos * 2.8 + uSeed * vec3(0.5, 0.3, 0.7);
    float turb = fbm(p);
    float t = sin(vLocalPos.x * 2.5 + turb * 5.0 + uSeed * 0.8) * 0.5 + 0.5;
    float s = fbm(p * 1.6 + vec3(uSeed * 0.4, uSeed * 0.9, uSeed * 0.2));
    t = clamp(t * 0.65 + s * 0.35, 0.0, 1.0);

    t += 0.015 * sin(uTime * 0.4 + uSeed);

    vec3 col;
    if (t < 0.42)       col = mix(uC1, uC2, t / 0.42);
    else if (t < 0.75)  col = mix(uC2, uC3, (t - 0.42) / 0.33);
    else                col = mix(uC3, uC1, (t - 0.75) / 0.25);

    vec3 L1   = normalize(vec3(1.2, 1.8, 2.0));
    vec3 L2   = normalize(vec3(-1.5, 0.3, 0.8));
    float diff = max(dot(N, L1), 0.0) * 0.70
               + max(dot(N, L2), 0.0) * 0.22
               + 0.08;
    vec3 R    = reflect(-L1, N);
    float spec = pow(max(dot(R, V), 0.0), 72.0) * 0.9;

    float NdotV  = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 2.8);
    vec3  rimCol  = mix(uC2 * 1.6, vec3(0.85, 0.92, 1.0), 0.45);

    vec3 emissive = uC1 * uEmissive * 0.38;

    vec3 finalCol = col * diff + vec3(0.95, 1.0, 1.05) * spec + emissive;
    finalCol = mix(finalCol, rimCol, fresnel * 0.50);

    gl_FragColor = vec4(clamp(finalCol, 0.0, 1.6),
                        uOpacity * (0.88 + NdotV * 0.12));
  }
`;

export function derivePlanetColors(hex: string, seed: number): [THREE.Color, THREE.Color, THREE.Color] {
  const c1 = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c1.getHSL(hsl);

  const shift2 = 0.12 + (seed % 13) * 0.022;
  const c2 = new THREE.Color().setHSL(
    (hsl.h + shift2) % 1,
    Math.min(hsl.s * 1.25 + 0.08, 1.0),
    Math.min(hsl.l + 0.22, 0.88),
  );

  const shift3 = 0.21 + (seed % 7) * 0.025;
  const c3 = new THREE.Color().setHSL(
    (hsl.h - shift3 + 1) % 1,
    Math.max(hsl.s * 0.72, 0.22),
    Math.max(hsl.l - 0.20, 0.18),
  );

  return [c1, c2, c3];
}

export function getPlanetRotation(seed: number): { rotAxis: THREE.Vector3; rotSpeed: number } {
  return {
    rotAxis: new THREE.Vector3(
      Math.sin(seed * 1.618) * 0.30,
      1.0,
      Math.cos(seed * 2.718) * 0.25,
    ).normalize(),
    rotSpeed: 0.004 + (seed % 13) * 0.0009,
  };
}
