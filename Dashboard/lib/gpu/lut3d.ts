export interface Lut3D {
  size: number;
  data: Float32Array;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
}

const MIN_LUT_SIZE = 2;
const MAX_LUT_SIZE = 64;

function validateSize(size: number): void {
  if (!Number.isInteger(size) || size < MIN_LUT_SIZE || size > MAX_LUT_SIZE) {
    throw new Error(`3D LUT size must be an integer between ${MIN_LUT_SIZE} and ${MAX_LUT_SIZE}.`);
  }
}

/**
 * Parses a standard .cube 3D LUT into Float32 RGBA data.
 * Cube rows are stored with red changing fastest, then green, then blue.
 */
export function parseCubeLut(source: string): Lut3D {
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const rawLine of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line || line.startsWith("TITLE")) continue;

    const [directive, ...tokens] = line.split(/\s+/);

    if (directive === "LUT_1D_SIZE") {
      throw new Error("1D .cube LUTs are not supported; provide a 3D LUT.");
    }

    if (directive === "LUT_3D_SIZE") {
      size = Number(tokens[0]);
      validateSize(size);
      continue;
    }

    if (directive === "DOMAIN_MIN" || directive === "DOMAIN_MAX") {
      const domain = tokens.slice(0, 3).map(Number);
      if (domain.length !== 3 || domain.some((value) => !Number.isFinite(value))) {
        throw new Error(`Invalid ${directive} declaration in .cube LUT.`);
      }
      if (directive === "DOMAIN_MIN") domainMin = domain as [number, number, number];
      else domainMax = domain as [number, number, number];
      continue;
    }

    const triplet = line.split(/\s+/);
    if (triplet.length === 3) {
      const red = Number(triplet[0]);
      const green = Number(triplet[1]);
      const blue = Number(triplet[2]);
      if ([red, green, blue].every(Number.isFinite)) values.push(red, green, blue);
    }
  }

  validateSize(size);
  if (domainMin.some((value, index) => domainMax[index] <= value)) {
    throw new Error("Each DOMAIN_MAX component must be greater than DOMAIN_MIN.");
  }

  const expectedValues = size ** 3;
  if (values.length !== expectedValues * 3) {
    throw new Error(
      `Expected ${expectedValues} LUT entries, received ${values.length / 3}.`,
    );
  }

  const data = new Float32Array(expectedValues * 4);
  for (let index = 0; index < expectedValues; index++) {
    const valueOffset = index * 3;
    const red = values[valueOffset];
    const green = values[valueOffset + 1];
    const blue = values[valueOffset + 2];
    const offset = index * 4;
    data[offset] = Math.max(0, Math.min(1, red));
    data[offset + 1] = Math.max(0, Math.min(1, green));
    data[offset + 2] = Math.max(0, Math.min(1, blue));
    data[offset + 3] = 1;
  }

  return { size, data, domainMin, domainMax };
}

export function createIdentityLut(size = 17): Lut3D {
  validateSize(size);
  const data = new Float32Array(size ** 3 * 4);

  for (let blue = 0; blue < size; blue++) {
    for (let green = 0; green < size; green++) {
      for (let red = 0; red < size; red++) {
        const offset = ((blue * size + green) * size + red) * 4;
        data[offset] = red / (size - 1);
        data[offset + 1] = green / (size - 1);
        data[offset + 2] = blue / (size - 1);
        data[offset + 3] = 1;
      }
    }
  }

  return { size, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1] };
}
