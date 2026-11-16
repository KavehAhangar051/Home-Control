import fs from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function tryResolveTsFile(candidatePath) {
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const withExt = `${candidatePath}${ext}`;

    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const targetPath = path.join(workspaceRoot, specifier.slice(2));
    const resolved = tryResolveTsFile(targetPath);

    if (resolved) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolved).href,
      };
    }
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentPath = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : workspaceRoot;
    const targetPath = path.resolve(parentPath, specifier);
    const resolved = tryResolveTsFile(targetPath);

    if (resolved) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolved).href,
      };
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const filePath = fileURLToPath(url);
    const source = fs.readFileSync(filePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      fileName: filePath,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });

    return {
      format: "module",
      shortCircuit: true,
      source: transpiled.outputText,
    };
  }

  return nextLoad(url, context);
}

register(import.meta.url, pathToFileURL("./"));
