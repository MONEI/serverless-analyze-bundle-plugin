import { Metadata, TemplateType, visualizer } from 'esbuild-visualizer';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import StreamZip from 'node-stream-zip';
import opn from 'open';
import { tmpdir } from 'os';
import { dirname, join, normalize, parse } from 'path';
import { FunctionDefinitionHandler } from 'serverless';
import Plugin from 'serverless/classes/Plugin';

import type { ServerlessAnalyzeBundlePlugin } from './serverlessAnalyzeBundle';

const getAllFiles = function (dirPath: string, arrayOfFilesInput: string[] = []) {
  const files = readdirSync(dirPath);

  let arrayOfFiles = arrayOfFilesInput;

  files.forEach(function (file) {
    const filePath = join(dirPath, file);
    if (statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
};

const TMP_FOLDER = join(tmpdir(), 'serverless-esbuild-bundle-analyzer');

async function bundleVisualizer(
  this: ServerlessAnalyzeBundlePlugin,
  options: { logging: Plugin.Logging; template: TemplateType },
): Promise<void> {
  const { analyze: functionName } = this.options;
  if (functionName === undefined) {
    return;
  }
  const slsFunction = this.serverless.service.getFunction(functionName);

  const fullZipPath = slsFunction.package?.artifact;
  if (fullZipPath === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    throw new this.serverless.classes.Error(
      `🤯 Analyze failed: function ${functionName} was not found`,
    );
  }
  const functionZipName = parse(fullZipPath).base;

  options.logging.log.notice(
    `⏳ Analyzing function ${functionName} POUWQEPOQUWEPOQUWEOWUE`,
    'ServerlessAnalyzeBundlePlugin',
  );

  const TEMP_DIR_LOCATION = join(TMP_FOLDER, functionZipName, new Date().getTime().toString());
  await mkdir(TEMP_DIR_LOCATION, { recursive: true });

  const functionZip = new StreamZip.async({ file: `.serverless/${functionZipName}` });
  await functionZip.extract(null, TEMP_DIR_LOCATION);

  const allFiles = getAllFiles(`${TEMP_DIR_LOCATION}`);
  const handlerPath = normalize((slsFunction as FunctionDefinitionHandler).handler.split('.')[0]);
  const metafileName = allFiles.filter(
    fileName => fileName.includes(handlerPath) && fileName.endsWith('-meta.json'),
  )[0];

  if (!metafileName) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    throw new this.serverless.classes.Error(
      `🤯 Analyze failed: function ${functionName} metadata was not found`,
    );
  }

  const textContent = readFileSync(metafileName, { encoding: 'utf-8' });
  const jsonContent = JSON.parse(textContent) as Metadata;

  const fileContent = await visualizer(jsonContent, {
    title: `${functionName} function bundle visualizer `,
    template: options.template,
  });

  const filename = `${TEMP_DIR_LOCATION}/${functionName}.html`;

  mkdirSync(dirname(filename), { recursive: true });
  writeFileSync(filename, fileContent);

  await opn(filename);
}

export default bundleVisualizer;
