let transcribedTexts: { text: any; timestamp: string; speaker: any; }[] = [];

export const addTranscribedText = (text: any, speaker: any) => {
  const timestamp = new Date().toISOString();
  transcribedTexts.push({ text, timestamp, speaker });
};

export const clearTranscribedTexts = () => {
  transcribedTexts = [];
};

export const generateFileContent = () => {
  return transcribedTexts
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(item => {
      const speaker = item.speaker === 'user' ? 'User' : 'Avatar';
      return `[${item.timestamp}] ${speaker}:\n${item.text}\n`;
    })
    .join('\n');
};

export const handleDownload = () => {
  const content = generateFileContent();
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const currentDate = new Date().toISOString().split('T')[0];
  a.download = `conversation_${currentDate}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};