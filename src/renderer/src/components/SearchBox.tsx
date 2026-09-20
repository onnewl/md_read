import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import type { KeyboardEvent, Ref } from "react";

type SearchBoxProps = {
  value: string;
  current: number;
  total: number;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange(value: string): void;
  onNext(): void;
  onPrevious(): void;
  onClear(): void;
};

export function SearchBox({
  value,
  current,
  total,
  disabled = false,
  inputRef,
  onChange,
  onNext,
  onPrevious,
  onClear
}: SearchBoxProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClear();
    }
  };

  return (
    <div className={value && total === 0 ? "search-box search-box--empty" : "search-box"}>
      <Search size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索当前文档"
        aria-label="搜索当前文档"
        disabled={disabled}
      />
      <span className="search-count" aria-live="polite">
        {value && total === 0 ? "无结果" : total > 0 ? `${current + 1} / ${total}` : "0 / 0"}
      </span>
      <button type="button" onClick={onPrevious} disabled={disabled || total === 0} title="上一个">
        <ArrowUp size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onNext} disabled={disabled || total === 0} title="下一个">
        <ArrowDown size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onClear} disabled={disabled || !value} title="清空搜索">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
