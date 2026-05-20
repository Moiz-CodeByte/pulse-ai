function cleanMessageText(text: string): string {
  return text
    .replace(/ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹\s*/g, '')
    .replace(/Ã°Å¸â€œâ€¹\s*/g, '')
    .replace(/ðŸ“‹\s*/g, '')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, '-')
    .replace(/Ã¢â‚¬â€/g, '-')
    .replace(/â€”/g, '-');
}

export function FormattedChatText({ text }: { text: string }) {
  const urlParts = cleanMessageText(text).split(/(https?:\/\/[^\s]+)/g);

  return (
    <>
      {urlParts.map((part, partIndex) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={`${part}-${partIndex}`}
              href={part}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2 break-all"
            >
              {part}
            </a>
          );
        }

        return part.split(/(\*\*[^*]+\*\*)/g).map((piece, pieceIndex) => {
          if (piece.startsWith('**') && piece.endsWith('**')) {
            return (
              <strong key={`${partIndex}-${pieceIndex}`} className="font-semibold">
                {piece.slice(2, -2)}
              </strong>
            );
          }

          return <span key={`${partIndex}-${pieceIndex}`}>{piece}</span>;
        });
      })}
    </>
  );
}
