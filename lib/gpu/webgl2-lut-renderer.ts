import type { Lut3D } from "./lut3d";

const VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 v_uv;

void main() {
  vec2 position = vec2(
    float((gl_VertexID << 1) & 2),
    float(gl_VertexID & 2)
  );
  v_uv = position * 0.5;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler3D u_lut;
uniform float u_intensity;
out vec4 out_color;

void main() {
  vec4 source = texture(u_source, v_uv);
  vec3 graded = texture(u_lut, clamp(source.rgb, 0.0, 1.0)).rgb;
  out_color = vec4(mix(source.rgb, graded, u_intensity), source.a);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate a WebGL shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader compilation error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Unable to allocate a WebGL program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown shader link error.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

/**
 * One renderer owns one WebGL2 context, one source texture and one 3D LUT.
 * Rendering is demand-driven: callers draw only after content or size changes.
 */
export class WebGL2LutRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly sourceTexture: WebGLTexture;
  private lutTexture: WebGLTexture | null = null;
  private lutTextureSize = 0;
  private uploadedLutData: Uint8Array | null = null;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: true,
    });

    if (!gl) throw new Error("WebGL 2 hardware acceleration is unavailable.");

    this.gl = gl;
    this.program = createProgram(gl);

    const vertexArray = gl.createVertexArray();
    const sourceTexture = gl.createTexture();
    if (!vertexArray || !sourceTexture) {
      if (vertexArray) gl.deleteVertexArray(vertexArray);
      if (sourceTexture) gl.deleteTexture(sourceTexture);
      gl.deleteProgram(this.program);
      throw new Error("Unable to allocate WebGL rendering resources.");
    }

    this.vertexArray = vertexArray;
    this.sourceTexture = sourceTexture;

    gl.bindVertexArray(vertexArray);
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_source"), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_lut"), 1);

    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  resize(width: number, height: number, devicePixelRatio = 1): boolean {
    if (this.disposed || this.gl.isContextLost() || width <= 0 || height <= 0) {
      return false;
    }

    const scale = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
    const pixelWidth = Math.max(1, Math.round(width * scale));
    const pixelHeight = Math.max(1, Math.round(height * scale));
    const canvas = this.gl.canvas as HTMLCanvasElement;

    if (canvas.width === pixelWidth && canvas.height === pixelHeight) return false;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    this.gl.viewport(0, 0, pixelWidth, pixelHeight);
    return true;
  }

  render(source: TexImageSource, lut: Lut3D, intensity = 1): boolean {
    const gl = this.gl;
    if (this.disposed || gl.isContextLost()) return false;
    if (lut.size < 2 || lut.size > 64 || lut.data.length !== lut.size ** 3 * 4) {
      throw new Error("Invalid 3D LUT texture data.");
    }

    if (!this.lutTexture || this.lutTextureSize !== lut.size) {
      if (this.lutTexture) gl.deleteTexture(this.lutTexture);
      const texture = gl.createTexture();
      if (!texture) throw new Error("Unable to allocate the 3D LUT texture.");

      this.lutTexture = texture;
      this.lutTextureSize = lut.size;
      this.uploadedLutData = null;

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, texture);
      gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, lut.size, lut.size, lut.size);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
    if (this.uploadedLutData !== lut.data) {
      gl.texSubImage3D(
        gl.TEXTURE_3D,
        0,
        0,
        0,
        0,
        lut.size,
        lut.size,
        lut.size,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        lut.data,
      );
      this.uploadedLutData = lut.data;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_intensity"),
      Math.max(0, Math.min(1, intensity)),
    );
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.gl.isContextLost()) return;
    this.gl.deleteTexture(this.sourceTexture);
    if (this.lutTexture) this.gl.deleteTexture(this.lutTexture);
    this.gl.deleteVertexArray(this.vertexArray);
    this.gl.deleteProgram(this.program);
  }
}
