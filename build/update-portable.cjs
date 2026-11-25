const { randomUUID } = require("node:crypto");
const { copyFile, mkdir, rename, rm } = require("node:fs/promises");
const { join } = require("node:path");

/**
 * 在 Windows 便携包构建完成后更新桌面快捷方式对应的固定文件。
 * @param {import("electron-builder").ArtifactCreated} artifact electron-builder 生成的产物事件。
 * @returns {Promise<void>} 固定文件已更新，或当前产物无需处理。
 * @throws {Error} 复制或替换失败时使打包报告错误。
 */
exports.default = async function updatePortable({ target, file, packager }) {
  if (target?.name !== "portable" || !file) {
    return;
  }

  const releaseDir = join(packager.projectDir, "release");
  const destination = join(releaseDir, "Markdown Viewer Portable.exe");
  const temporaryFile = join(releaseDir, `.portable-${randomUUID()}.tmp`);
  await mkdir(releaseDir, { recursive: true });

  // 先在同目录完整复制，避免复制中断或文件被占用时留下损坏的快捷方式目标。
  try {
    await copyFile(file, temporaryFile);
    await rename(temporaryFile, destination);
  } finally {
    await rm(temporaryFile, { force: true });
  }
  console.log(`已更新 Windows 便携包：${destination}`);
};
