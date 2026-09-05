import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./Markdown.module.css";

type MarkdownProps = {
  /** Markdown source from a test document (hints, explanations). */
  children: string;
  /** Extra class on the wrapper, for spacing in the surrounding layout. */
  className?: string;
};

/**
 * Renders test copy written in Markdown. Raw HTML is not enabled, so authored
 * test files cannot inject markup into the page.
 */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={className ? `${styles.prose} ${className}` : styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">{linkChildren}</a>
          ),
          table: ({ children: tableChildren }) => (
            <div className={styles.tableScroll}><table>{tableChildren}</table></div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
