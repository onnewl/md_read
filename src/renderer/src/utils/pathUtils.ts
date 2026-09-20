const markdownFilePattern = /\.(md|markdown)$/i;

export function isMarkdownFilePath(filePath: string): boolean {
  return markdownFilePattern.test(filePath);
}

export function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}
