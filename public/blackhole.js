import { blackHoleSource } from './universe-shaders.js';

// A transparent, ray-traced accretion disk sits over the lensed page star field.
export function createBlackHole(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return;
  let program, uniforms;
  function prepare() {
    program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, '#version 300 es\nin vec2 aPos; void main(){gl_Position=vec4(aPos,0.,1.);}'],[gl.FRAGMENT_SHADER, blackHoleSource]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); program = null; return; }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    uniforms = Object.fromEntries(['uSize','uTime','uSeed','uParam','uDpr','uView','uZoom'].map(key=>[key, gl.getUniformLocation(program,key)]));
    gl.uniform1f(uniforms.uSeed, 42);
    gl.uniform1f(uniforms.uDpr, 1);
    gl.uniform1f(uniforms.uZoom, 2.6);
  }
  prepare();
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); program = null; canvas.classList.remove('is-rendered'); });
  canvas.addEventListener('webglcontextrestored', prepare);
  return function draw(time, pixels) {
    if (!program) return;
    if (canvas.width !== pixels || canvas.height !== pixels) canvas.width = canvas.height = pixels;
    gl.viewport(0,0,pixels,pixels);
    gl.uniform2f(uniforms.uSize, pixels,pixels);
    gl.uniform3f(uniforms.uView, 0,0,pixels);
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform1f(uniforms.uParam, 10.4 + 1.8 * Math.sin(time * .065));
    gl.drawArrays(gl.TRIANGLES,0,3);
    canvas.classList.add('is-rendered');
  };
}
