import { GoogleGenAI, Modality } from "@google/genai";

export const generateImageForScene = async (scenePrompt: string, storyContext: string, theme: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("The API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Construct a more detailed prompt for consistency, aspect ratio, and theme.
  let fullPrompt = `You are a storyboard artist. Create a single, visually striking image for a scene.

IMPORTANT RULES:
- The image MUST be in a landscape aspect ratio.
- Do NOT add any text, words, letters, or numbers on the image itself.
- The image style must be consistent with the story's theme and context.

`;

  if (theme) {
    fullPrompt += `**Overall Theme:**\n${theme}\n\n`;
  }

  if (storyContext) {
    fullPrompt += `**Story Context (previous scenes):**\n${storyContext}\n\n`;
  }

  fullPrompt += `**Current Scene to draw:**\n${scenePrompt}`;

  const textPart = { text: fullPrompt };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [textPart],
    },
    config: {
        responseModalities: [Modality.IMAGE],
    },
  });

  // Extract the first image part from the response
  const firstPart = response.candidates?.[0]?.content?.parts?.[0];
  if (firstPart && firstPart.inlineData) {
    return firstPart.inlineData.data; // This is the base64 string of the generated image
  }

  throw new Error(`No image was generated for the prompt: "${scenePrompt}"`);
};