"use client";

function AiAvatar() {
  return (
    <div className="shrink-0 w-7 h-7 rounded-[7px] bg-[#4F46E5] flex items-center justify-center">
      <svg
        className="w-3.5 h-3.5 text-white"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
      </svg>
    </div>
  );
}

// Render inline minimo de markdown: **negrita**, *italica*, _italica_.
function renderInline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g)
    .map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (/^\*[^*\n]+\*$/.test(part) || /^_[^_\n]+_$/.test(part)) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }

      return part;
    });
}

interface MessageBubbleProps {
  role: "ai" | "user";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === "ai") {
    return (
      <div className="flex gap-3 items-start">
        <AiAvatar />
        <p className="text-sm leading-relaxed text-[#1A1A1A] pt-0.5 max-w-[560px]">
          {renderInline(content)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="bg-[#4F46E5] text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-[4px] max-w-md">
        {content}
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex gap-3 items-start">
      <AiAvatar />
      <div className="flex items-center gap-1 h-7">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]/50 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
    </div>
  );
}
