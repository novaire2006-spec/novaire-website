/* WebGL 2 accretion disk adapted from Novaire’s universe_blackhole.frag. */
export const blackHoleSource = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uTime;
uniform float uSeed;
uniform float uParam;
uniform float uZoom;
out vec4 fragColor;
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float gcorner(vec3 i, vec3 f, vec3 o) {
  return dot(hash33(i + o) * 2.0 - 1.0, f - o);
}
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = gcorner(i, f, vec3(0.0, 0.0, 0.0));
  float b = gcorner(i, f, vec3(1.0, 0.0, 0.0));
  float c = gcorner(i, f, vec3(0.0, 1.0, 0.0));
  float d = gcorner(i, f, vec3(1.0, 1.0, 0.0));
  float e = gcorner(i, f, vec3(0.0, 0.0, 1.0));
  float g = gcorner(i, f, vec3(1.0, 0.0, 1.0));
  float h = gcorner(i, f, vec3(0.0, 1.0, 1.0));
  float k = gcorner(i, f, vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
             mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}
vec3 octaveTurn(vec3 p) {
  return mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64) * p;
}
float zoomLod() {
  return clamp(log2(max(uZoom, 1.0)) * 1.25, 0.0, 3.0);
}
float fbmLod(vec3 p, float lod) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 8; i++) {
    float w = clamp(lod + 5.0 - float(i), 0.0, 1.0);
    if (w <= 0.0) {
      break;
    }
    s += a * w * gnoise(p);
    p = octaveTurn(p) * 2.03;
    a *= 0.5;
  }
  return s;
}
vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332048), 0.0, 1.0);
  float g = t <= 66.0
      ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
      : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0
      : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
  vec3 c = pow(vec3(r, g, b), vec3(2.2));
  return c / max(c.r, max(c.g, c.b));
}
vec3 tonemap(vec3 x) {
  vec3 c = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  return pow(c, vec3(1.0 / 2.2));
}
vec4 finish(vec3 hdr, float body, vec2 uv) {
  vec3 col = tonemap(hdr);
  float glow = clamp(max(col.r, max(col.g, col.b)) * 1.1, 0.0, 1.0);
  vec2 ext = uSize / min(uSize.x, uSize.y);
  vec2 e = abs(uv) / ext;
  float fade = (1.0 - smoothstep(0.80, 1.0, length(uv))) *
      (1.0 - smoothstep(0.90, 1.0, max(e.x, e.y)));
  col *= max(body, fade);
  return vec4(col, max(body, glow * fade));
}
vec4 renderObject(vec2 fc) {
  float m = min(uSize.x, uSize.y);
  vec2 uv = (fc - 0.5 * uSize) / (0.5 * m);
  float lod = zoomLod();
  float t = uTime;
  float elev = radians(uParam > 0.0 ? uParam : 9.0);
  float dist = 22.0;
  vec3 ro = vec3(0.0, sin(elev), -cos(elev)) * dist;
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  float tiltR = -0.12;
  vec2 uvr = mat2(cos(tiltR), -sin(tiltR), sin(tiltR), cos(tiltR)) * uv;
  vec3 rd = normalize(fw + (uvr.x * rt - uvr.y * up) * 0.62);
  vec3 pos = ro;
  vec3 vel = rd;
  vec3 hc = cross(pos, vel);
  float h2 = dot(hc, hc);
  vec3 col = vec3(0.0);
  float trans = 1.0;
  float inner = 2.6;
  float outer = 11.0;
  for (int i = 0; i < 320; i++) {
    float r = length(pos);
    if (r < 1.0 || r > 40.0 || trans < 0.01) {
      break;
    }
    float dt = clamp(0.045 * r, 0.02, 0.7);
    vec3 acc = -1.5 * h2 * pos / pow(r, 5.0);
    vec3 nv = vel + acc * dt;
    vec3 np = pos + nv * dt;
    if (pos.y * np.y < 0.0) {
      vec3 hit = mix(pos, np, pos.y / (pos.y - np.y));
      float hr = length(hit.xz);
      if (hr > inner && hr < outer) {
        float omega = pow(hr, -1.5);
        float ang = atan(hit.z, hit.x) - t * omega * 1.8;
        vec3 dp = vec3(cos(ang) * 2.4, sin(ang) * 2.4, hr * 2.2);
        float swirlN = fbmLod(dp + uSeed, lod);
        float streaks = 0.8 + 0.2 * gnoise(vec3(cos(ang) * 6.0, sin(ang) * 6.0, hr * 9.0)) +
            0.18 * clamp(lod, 0.0, 1.0) * gnoise(vec3(cos(ang) * 3.0, sin(ang) * 3.0, hr * 46.0)) +
            0.10 * clamp(lod - 1.0, 0.0, 1.0) * gnoise(vec3(cos(ang) * 22.0, sin(ang) * 22.0, hr * 120.0));
        float edgeIn = smoothstep(inner, inner + 0.6, hr);
        float edgeOut = 1.0 - smoothstep(outer * 0.55, outer, hr);
        float dens = clamp((0.7 + swirlN * 1.1) * streaks, 0.0, 1.0) * edgeIn * edgeOut;
        float prof = pow(inner / hr, 0.75) * pow(max(1.0 - sqrt(inner * 0.9 / hr), 0.02), 0.25);
        vec3 orbit = normalize(vec3(-hit.z, 0.0, hit.x));
        float beta = clamp(sqrt(0.5 / hr), 0.0, 0.6);
        float gamma = 1.0 / sqrt(1.0 - beta * beta);
        float cosT = dot(orbit, -normalize(nv));
        float dop = 1.0 / (gamma * (1.0 - beta * cosT));
        float grav = sqrt(max(1.0 - 1.0 / hr, 0.05));
        float shift = dop * grav;
        vec3 emit = blackbody(1500.0 + 4200.0 * prof * shift) * prof * pow(shift, 3.5) * 3.0;
        col += trans * emit * dens;
        trans *= 1.0 - dens * 0.96;
      }
    }
    vel = nv;
    pos = np;
  }
  float captured = length(pos) < 1.0 ? 1.0 : 0.0;
  // Grazing rays form a narrow bright rim, strongest on the approaching side.
  float impact = length(hc);
  float critical = 2.598;
  float rim = exp(-abs(impact - critical) / max(0.016, fwidth(impact))) * (1.0 - captured);
  col += trans * rim * vec3(1.0, .68, .40) * (.18 + .14 * rd.x);
  vec3 hdr = col;
  float body = clamp(1.0 - trans + captured, 0.0, 1.0);
  return finish(hdr, body, uv);
}
uniform float uDpr;
uniform vec3 uView;
vec4 FlutterFragCoord() { return vec4(gl_FragCoord.x / uDpr + uView.x, uView.y + uView.z - gl_FragCoord.y / uDpr, 0.0, 1.0); }
void main() {
  fragColor = renderObject(FlutterFragCoord().xy);
}
`;
