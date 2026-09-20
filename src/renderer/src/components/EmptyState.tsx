import { FileSearch } from "lucide-react";

type EmptyStateProps = {
  onOpen(): void;
};

export function EmptyState({ onOpen }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <FileSearch size={48} aria-hidden="true" />
      <h1>请选择一个 Markdown 文件</h1>
      <p>支持 .md / .markdown 文件、相对路径图片、大纲跳转和全文搜索。</p>
      <button type="button" className="primary-action" onClick={onOpen}>
        打开文件
      </button>
    </div>
  );
}
