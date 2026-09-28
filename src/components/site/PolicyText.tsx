import { parsePolicyText } from '@/lib/policy-text';

/** Texto de política (escrito no sistema) exibido no site: parágrafos, subtítulos e listas — sempre como texto puro. */
export function PolicyText({ text }: { text: string }) {
  return (
    <div className="policy-text">
      {parsePolicyText(text).map((block, index) => {
        if (block.type === 'heading') return <h2 key={index}>{block.text}</h2>;
        if (block.type === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}
