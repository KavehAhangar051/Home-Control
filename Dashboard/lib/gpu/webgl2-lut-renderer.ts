import type { Lut3D } from "./lut3d";

const VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_canvas_size;
uniform vec2 u_image_size;
out vec2 v_image_uv;

void main() {
  vec2 position = vec2(
    float((gl_VertexID << 1) & 2),
    float(gl_VertexID & 2)
  );
  float canvas_aspect = u_canvas_size.x / u_canvas_size.y;
  float image_aspect = u_image_size.x / u_image_size.y;
  vec2 uv_scale = vec2(1.0);
  if (image_aspect > canvas_aspect) {
    uv_scale.x = canvas_aspect / image_aspect;
  } else {
    uv_scale.y = image_aspect / canvas_aspect;
  }
  v_image_uv = (position * 0.5 - 0.5) * uv_scale + 0.5;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_image_uv;
uniform sampler2D u_source;
uniform sampler3D u_lut;
uniform float u_intensity;
uniform vec3 u_domain_min;
uniform vec3 u_domain_max;
out vec4 out_color;

void main() {
  vec4 source = texture(u_source, v_image_uv);
  vec3 lut_coordinate = clamp(
    (source.rgb - u_domain_min) / (u_domain_max - u_domain_min),
    0.0,
    1.0
  );
  vec3 graded = texture(u_lut, lut_coordinate).rgb;
  out_color = vec4(mix(source.rgb, graded, u_intensity), source.a);
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  deferStatusCheck: boolean,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate a WebGL shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!deferStatusCheck && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader compilation error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function waitForProgramCompletion(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  extension: { COMPLETION_STATUS_KHR: number },
): Promise<void> {
  return new Promise((resolve) => {
    const poll = () => {
      if (
        gl.isContextLost() ||
        gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR)
      ) {
        resolve();
        return;
      }

      requestAnimationFrame(poll);
    };

    requestAnimationFrame(poll);
  });
}

async function createProgram(gl: WebGL2RenderingContext): Promise<WebGLProgram> {
  const parallelCompile = gl.getExtension("KHR_parallel_shader_compile");
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    VERTEX_SHADER,
    parallelCompile !== null,
  );
  let fragmentShader: WebGLShader | null = null;
  let program: WebGLProgram | null = null;

  try {
    fragmentShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      FRAGMENT_SHADER,
      parallelCompile !== null,
    );
    program = gl.createProgram();
    if (!program) throw new Error("Unable to allocate a WebGL program.");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (parallelCompile) {
      await waitForProgramCompletion(gl, program, parallelCompile);
      if (gl.isContextLost()) {
        throw new Error("WebGL context was lost during shader compilation.");
      }
    }

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message =
        gl.getProgramInfoLog(program) ??
        gl.getShaderInfoLog(vertexShader) ??
        gl.getShaderInfoLog(fragmentShader) ??
        "Unknown shader link error.";
      throw new Error(message);
    }

    return program;
  } catch (error) {
    if (program) gl.deleteProgram(program);
    throw error;
  } finally {
    gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
  }
}

/**
 * One renderer owns one WebGL2 context, one source texture and one 3D LUT.
 * Rendering is demand-driven: callers draw only after content or size changes.
 */
export class WebGL2LutRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly maxDrawingBufferWidth: number;
  private readonly maxDrawingBufferHeight: number;
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly sourceTexture: WebGLTexture;
  private readonly intensityLocation: WebGLUniformLocation | null;
  private readonly canvasSizeLocation: WebGLUniformLocation | null;
  private readonly imageSizeLocation: WebGLUniformLocation | null;
  private readonly domainMinLocation: WebGLUniformLocation | null;
  private readonly domainMaxLocation: WebGLUniformLocation | null;
  private lutTexture: WebGLTexture | null = null;
  private lutTextureSize = 0;
  private uploadedLutData: Float32Array | null = null;
  private uploadedSource: TexImageSource | null = null;
  private disposed = false;

  static async create(canvas: HTMLCanvasElement): Promise<WebGL2LutRenderer> {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: true,
    });

    if (!gl) throw new Error("WebGL 2 hardware acceleration is unavailable.");

    const program = await createProgram(gl);
    try {
      return new WebGL2LutRenderer(canvas, gl, program);
    } catch (error) {
      gl.deleteProgram(program);
      throw error;
    }
  }

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
  ) {
    this.gl = gl;

    const maxViewportDimensions = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    this.maxDrawingBufferWidth = Math.max(
      1,
      Math.min(maxRenderbufferSize, maxViewportDimensions[0] ?? maxRenderbufferSize),
    );
    this.maxDrawingBufferHeight = Math.max(
      1,
      Math.min(maxRenderbufferSize, maxViewportDimensions[1] ?? maxRenderbufferSize),
    );

    this.program = program;

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
    gl.viewport(0, 0, canvas.width, canvas.height);
    const activateProgram = gl.useProgram.bind(gl);
    activateProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_source"), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_lut"), 1);
    this.intensityLocation = gl.getUniformLocation(this.program, "u_intensity");
    this.canvasSizeLocation = gl.getUniformLocation(this.program, "u_canvas_size");
    this.imageSizeLocation = gl.getUniformLocation(this.program, "u_image_size");
    this.domainMinLocation = gl.getUniformLocation(this.program, "u_domain_min");
    this.domainMaxLocation = gl.getUniformLocation(this.program, "u_domain_max");

    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  }

  resize(width: number, height: number, devicePixelRatio = 1): boolean {
    if (
      this.disposed ||
      this.gl.isContextLost() ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return false;
    }

    const scale = Math.min(
      Math.max(devicePixelRatio || 1, 1),
      this.maxDrawingBufferWidth / width,
      this.maxDrawingBufferHeight / height,
      4096 / Math.max(width, height),
    );
    const pixelWidth = Math.max(1, Math.round(width * scale));
    const pixelHeight = Math.max(1, Math.round(height * scale));
    const canvas = this.gl.canvas as HTMLCanvasElement;

    if (canvas.width === pixelWidth && canvas.height === pixelHeight) return false;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    this.gl.viewport(0, 0, pixelWidth, pixelHeight);
    return true;
  }

  render(
    source: TexImageSource,
    lut: Lut3D,
    sourceWidth: number,
    sourceHeight: number,
    intensity = 1,
  ): boolean {
    const gl = this.gl;
    if (this.disposed || gl.isContextLost()) return false;
    if (
      lut.size < 2 ||
      lut.size > 64 ||
      lut.data.length !== lut.size ** 3 * 4 ||
      !Number.isFinite(sourceWidth) ||
      !Number.isFinite(sourceHeight) ||
      sourceWidth <= 0 ||
      sourceHeight <= 0 ||
      lut.domainMin.some(
        (value, index) =>
          !Number.isFinite(value) ||
          !Number.isFinite(lut.domainMax[index]) ||
          lut.domainMax[index] <= value,
      ) ||
      sourceWidth > 4096 ||
      sourceHeight > 4096
    ) {
      throw new Error("Invalid 3D LUT or source image dimensions.");
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
      gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA16F, lut.size, lut.size, lut.size);
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
        gl.FLOAT,
        lut.data,
      );
      this.uploadedLutData = lut.data;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    if (this.uploadedSource !== source) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      this.uploadedSource = source;
    }

    const activateProgram = gl.useProgram.bind(gl);
    activateProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    const canvas = gl.canvas as HTMLCanvasElement;
    const normalizedIntensity = Number.isFinite(intensity)
      ? Math.max(0, Math.min(1, intensity))
      : 1;
    gl.uniform1f(this.intensityLocation, normalizedIntensity);
    gl.uniform2f(this.canvasSizeLocation, canvas.width, canvas.height);
    gl.uniform2f(this.imageSizeLocation, sourceWidth, sourceHeight);
    gl.uniform3fv(this.domainMinLocation, lut.domainMin);
    gl.uniform3fv(this.domainMaxLocation, lut.domainMax);
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
