export type TextChunk = {
  id: number;
  text: string;
};

const maxChunkCharacters = 1400;
const overlapCharacters = 180;

export const chunkResumeText = (text: string): TextChunk[] => {
  const blocks = text
    .split(/\n{2,}|(?=\n[A-Z][A-Z\s/&-]{3,}\n)/)
    .map((block) => block.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;

    if (candidate.length <= maxChunkCharacters) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (block.length <= maxChunkCharacters) {
      current = block;
      continue;
    }

    for (let start = 0; start < block.length; start += maxChunkCharacters - overlapCharacters) {
      chunks.push(block.slice(start, start + maxChunkCharacters).trim());
    }
    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((chunk, index) => ({ id: index + 1, text: chunk }));
};
