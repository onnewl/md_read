import GithubSlugger from "github-slugger";

/**
 * 创建与 GitHub 风格一致的标题 id 生成器。
 * @returns 一个按调用顺序处理重复标题的 slug 函数。
 */
export function createHeadingSlugger(): (text: string) => string {
  const slugger = new GithubSlugger();
  return (text: string) => slugger.slug(text);
}
