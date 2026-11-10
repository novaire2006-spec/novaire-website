/* Generated from the Novaire app shaders universe_galaxy.frag and universe_blackhole.frag
   (comments removed, wrapped for WebGL 2). The galaxy takes one extra uniform, uSpin, an added
   rotation angle; its look is unchanged. Change the app shaders first, then regenerate. */
export const galaxySource = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uTime;
uniform float uSeed;
uniform float uParam;
uniform float uBackground;
uniform float uZoom;
uniform float uSpin;
out vec4 fragColor;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
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
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * gnoise(p);
    p = octaveTurn(p) * 2.03;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * gnoise(p);
    p = octaveTurn(p) * 2.03;
    a *= 0.5;
  }
  return s;
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
vec2 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 r = o + hash33(i + o) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  return sqrt(vec2(d1, d2));
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
vec3 srgbToLinear(vec3 c) {
  return pow(c, vec3(2.2));
}
vec3 tonemap(vec3 x) {
  vec3 c = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  return pow(c, vec3(1.0 / 2.2));
}
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
vec3 skyStars(vec2 uv, float pixel) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float scale = 22.0 + fl * 31.0;
    vec2 g = uv * scale + fl * 13.7;
    vec2 id = floor(g);
    vec2 h = hash22(id + fl * 41.0);
    vec2 pos = id + 0.15 + 0.7 * h;
    float d = length(g - pos) / (pixel * scale);
    float pick = hash12(id * 1.37 + fl);
    float on = step(0.91, pick);
    float mag = pow((pick - 0.91) / 0.09, 6.0) * on;
    float twinkle = 0.8 + 0.2 * sin(uTime * (1.3 + 2.0 * h.y) + h.x * 50.0);
    vec3 tint = blackbody(mix(2800.0, 14000.0, pow(h.y, 1.6)));
    col += tint * (mag * 1.1 + 0.006 * on) * twinkle * (exp(-d * d * 0.6) + 0.05 * mag * exp(-d * 0.5));
  }
  return col;
}
vec3 sky(vec2 uv, float pixel) {
  float haze = smoothstep(0.1, 0.9, 0.5 + fbm3(vec3(uv * 1.2, 3.0))) *
      exp(-abs(uv.y * 0.9 + uv.x * 0.35) * 1.8);
  vec3 col = vec3(0.010, 0.012, 0.022) + vec3(0.035, 0.030, 0.045) * haze;
  return col + skyStars(uv, pixel);
}
vec4 finish(vec3 hdr, float body, vec2 uv, float pixel) {
  vec3 col = tonemap(hdr);
  float glow = clamp(max(col.r, max(col.g, col.b)) * 1.1, 0.0, 1.0);
  float a = max(body, glow);
  if (uBackground > 0.5) {
    vec3 bg = tonemap(sky(uv, pixel));
    return vec4(col + bg * (1.0 - a), 1.0);
  }
  vec2 ext = uSize / min(uSize.x, uSize.y);
  vec2 e = abs(uv) / ext;
  float fade = (1.0 - smoothstep(0.80, 1.0, length(uv))) *
      (1.0 - smoothstep(0.90, 1.0, max(e.x, e.y)));
  col *= max(body, fade);
  return vec4(col, max(body, glow * fade));
}
float galaxyStars(vec2 g, float density, float pixelCells) {
  vec2 id = floor(g);
  vec2 h = hash22(id);
  vec2 pos = id + 0.2 + 0.6 * h;
  float d = length(g - pos) / pixelCells;
  float on = step(1.0 - density, hash12(id * 1.91));
  return on * (0.4 + 2.0 * pow(h.y, 6.0)) * exp(-d * d * 0.7);
}
vec4 renderObject(vec2 fc) {
  float m = min(uSize.x, uSize.y);
  vec2 uv = (fc - 0.5 * uSize) / (0.5 * m);
  float pixel = 2.0 / (m * max(uZoom, 1.0));
  float lod = zoomLod();
  float t = uTime;
  float incl = radians(uParam > 0.0 ? uParam : 58.0);
  float pa = 0.52 + uSeed * 0.37;
  vec2 q = mat2(cos(pa), -sin(pa), sin(pa), cos(pa)) * uv;
  q.y /= cos(incl);
  q *= 1.08;
  float r = length(q);
  float th = atan(q.y, q.x) - t * 0.035 - uSpin;
  vec2 qr = r * vec2(cos(th), sin(th));
  float warp = fbm(vec3(qr * 2.6, uSeed * 1.3));
  float lr = log(max(r, 0.003));
  float pitch = 0.27;
  float phase = 2.0 * (th - lr / pitch) + warp * 2.4;
  float arm = pow(0.5 + 0.5 * cos(phase), 2.4);
  float spur = pow(0.5 + 0.5 * cos(2.0 * phase + warp * 6.0), 6.0) * 0.35;
  float armMask = smoothstep(0.06, 0.18, r);
  arm = mix(0.25, arm + spur, armMask);
  float disk = exp(-r / 0.23) * (1.0 - smoothstep(0.75, 1.05, r));
  float bulge = 3.2 * exp(-pow(r / 0.045, 0.8)) + 0.55 * exp(-r / 0.11);
  float bar = exp(-pow(abs(qr.x) / 0.16, 2.0) - pow(abs(qr.y) / 0.045, 2.0)) * 0.35;
  float mott = 0.45 + 1.1 * (0.5 + fbmLod(vec3(qr * 9.0, uSeed + 3.0), lod));
  float knotsN = gnoise(vec3(qr * 34.0, uSeed + 7.0)) + 0.25 * gnoise(vec3(qr * 80.0, uSeed)) +
      0.2 * clamp(lod, 0.0, 1.0) * gnoise(vec3(qr * 210.0, uSeed + 1.0));
  float knots = smoothstep(0.22, 0.55, knotsN) * arm * armMask * (1.0 - smoothstep(0.55, 0.9, r));
  float dust = pow(0.5 + 0.5 * cos(phase - 0.85), 7.0);
  dust *= 0.5 + 1.0 * (0.5 + fbmLod(vec3(qr * 13.0, uSeed + 11.0), lod));
  dust += 0.35 * clamp(lod - 0.5, 0.0, 1.0) *
      smoothstep(0.15, 0.6, fbm3(vec3(qr * 46.0, uSeed + 5.0))) *
      smoothstep(0.08, 0.2, r) * (1.0 - smoothstep(0.6, 0.95, r));
  dust *= smoothstep(0.05, 0.14, r) * (1.0 - smoothstep(0.55, 0.9, r));
  dust += 0.35 * smoothstep(0.0, 0.5, -q.y / max(r, 0.01)) * exp(-pow((r - 0.42) / 0.25, 2.0)) * (0.5 + fbm3(vec3(qr * 20.0, 2.0)));
  vec3 old = srgbToLinear(vec3(1.0, 0.86, 0.66));
  vec3 young = srgbToLinear(vec3(0.62, 0.76, 1.0));
  vec3 hii = srgbToLinear(vec3(1.0, 0.42, 0.62));
  vec3 hdr = old * (bulge + bar) * 1.25;
  hdr += mix(old, young, smoothstep(0.06, 0.32, r)) * disk * (0.18 + 1.9 * arm) * mott * 0.85;
  hdr += hii * knots * disk * 5.5;
  hdr += young * knots * disk * 2.0;
  hdr *= exp(-dust * 2.3 * vec3(0.72, 1.0, 1.4));
  hdr += old * exp(-r / 0.45) * 0.022;
  float cells = 150.0;
  float starDensity = clamp(arm * disk * 0.9, 0.0, 0.22);
  float sparkle = galaxyStars(uv * cells + uSeed * 9.0, starDensity, max(pixel * cells, 0.12));
  float tw = 0.8 + 0.2 * sin(t * 2.3 + dot(floor(uv * cells), vec2(1.7, 3.1)));
  hdr += mix(young, vec3(1.0), 0.3) * sparkle * tw * 0.45 * smoothstep(0.08, 0.2, r);
  if (lod > 0.1) {
    float cells2 = 520.0;
    float faint = galaxyStars(uv * cells2 + uSeed * 3.0, clamp(disk * (0.25 + arm) * 0.5, 0.0, 0.35),
        max(pixel * cells2, 0.12));
    hdr += mix(old, young, smoothstep(0.1, 0.5, r)) * faint * 0.22 * clamp(lod, 0.0, 1.0) *
        smoothstep(0.05, 0.15, r);
    float grain = gnoise(vec3(qr * 380.0, uSeed));
    hdr *= 1.0 + 0.10 * clamp(lod - 0.5, 0.0, 1.0) * grain * disk;
  }
  return finish(hdr * 1.15, 0.0, uv, pixel);
}
uniform float uDpr;
uniform vec3 uView;
vec4 FlutterFragCoord() { return vec4(gl_FragCoord.x / uDpr + uView.x, uView.y + uView.z - gl_FragCoord.y / uDpr, 0.0, 1.0); }
void main() {
  fragColor = renderObject(FlutterFragCoord().xy);
}
`;

export const blackHoleSource = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uTime;
uniform float uSeed;
uniform float uParam;
uniform float uBackground;
uniform float uZoom;
out vec4 fragColor;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
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
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * gnoise(p);
    p = octaveTurn(p) * 2.03;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * gnoise(p);
    p = octaveTurn(p) * 2.03;
    a *= 0.5;
  }
  return s;
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
vec2 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 r = o + hash33(i + o) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  return sqrt(vec2(d1, d2));
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
vec3 srgbToLinear(vec3 c) {
  return pow(c, vec3(2.2));
}
vec3 tonemap(vec3 x) {
  vec3 c = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  return pow(c, vec3(1.0 / 2.2));
}
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
vec3 skyStars(vec2 uv, float pixel) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float scale = 22.0 + fl * 31.0;
    vec2 g = uv * scale + fl * 13.7;
    vec2 id = floor(g);
    vec2 h = hash22(id + fl * 41.0);
    vec2 pos = id + 0.15 + 0.7 * h;
    float d = length(g - pos) / (pixel * scale);
    float pick = hash12(id * 1.37 + fl);
    float on = step(0.91, pick);
    float mag = pow((pick - 0.91) / 0.09, 6.0) * on;
    float twinkle = 0.8 + 0.2 * sin(uTime * (1.3 + 2.0 * h.y) + h.x * 50.0);
    vec3 tint = blackbody(mix(2800.0, 14000.0, pow(h.y, 1.6)));
    col += tint * (mag * 1.1 + 0.006 * on) * twinkle * (exp(-d * d * 0.6) + 0.05 * mag * exp(-d * 0.5));
  }
  return col;
}
vec3 sky(vec2 uv, float pixel) {
  float haze = smoothstep(0.1, 0.9, 0.5 + fbm3(vec3(uv * 1.2, 3.0))) *
      exp(-abs(uv.y * 0.9 + uv.x * 0.35) * 1.8);
  vec3 col = vec3(0.010, 0.012, 0.022) + vec3(0.035, 0.030, 0.045) * haze;
  return col + skyStars(uv, pixel);
}
vec4 finish(vec3 hdr, float body, vec2 uv, float pixel) {
  vec3 col = tonemap(hdr);
  float glow = clamp(max(col.r, max(col.g, col.b)) * 1.1, 0.0, 1.0);
  float a = max(body, glow);
  if (uBackground > 0.5) {
    vec3 bg = tonemap(sky(uv, pixel));
    return vec4(col + bg * (1.0 - a), 1.0);
  }
  vec2 ext = uSize / min(uSize.x, uSize.y);
  vec2 e = abs(uv) / ext;
  float fade = (1.0 - smoothstep(0.80, 1.0, length(uv))) *
      (1.0 - smoothstep(0.90, 1.0, max(e.x, e.y)));
  col *= max(body, fade);
  return vec4(col, max(body, glow * fade));
}
vec3 umbraSky(vec3 d, float pixel) {
  vec2 sp = vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0))) / 0.62;
  return sky(sp, pixel);
}
vec4 renderObject(vec2 fc) {
  float m = min(uSize.x, uSize.y);
  vec2 uv = (fc - 0.5 * uSize) / (0.5 * m);
  float pixel = 2.0 / (m * max(uZoom, 1.0));
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
  vec3 sky = umbraSky(normalize(vel), pixel) * (1.0 - captured);
  vec3 hdr = col + trans * sky * step(0.5, uBackground);
  float body = uBackground > 0.5 ? 1.0 : clamp(1.0 - trans + captured, 0.0, 1.0);
  return finish(hdr, body, uv, pixel);
}
uniform float uDpr;
uniform vec3 uView;
vec4 FlutterFragCoord() { return vec4(gl_FragCoord.x / uDpr + uView.x, uView.y + uView.z - gl_FragCoord.y / uDpr, 0.0, 1.0); }
void main() {
  fragColor = renderObject(FlutterFragCoord().xy);
}
`;
