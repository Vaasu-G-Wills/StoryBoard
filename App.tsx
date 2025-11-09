import React, { useState } from 'react';
import { generateImageForScene } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import JSZip from 'jszip';

// Helper component for displaying an image with its prompt, scene number, and download button
const ImageContainer: React.FC<{ src: string; alt: string; prompt: string; sceneNumber: number; }> = ({ src, alt, prompt, sceneNumber }) => {
    
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = src;
        // Sanitize prompt for filename
        const safePrompt = prompt.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `scene_${String(sceneNumber).padStart(2, '0')}_${safePrompt}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg animate-fade-in group relative">
            <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-60 text-white text-xs font-bold px-2 py-1 rounded">
                Scene {sceneNumber}
            </div>
            <button
                onClick={handleDownload}
                className="absolute top-2 right-2 z-10 bg-black bg-opacity-60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-blue-600"
                aria-label="Download image"
                title="Download image"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>
            <div className="w-full aspect-video bg-black flex items-center justify-center p-1">
                <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded" />
            </div>
            <p className="text-xs text-gray-400 p-2 truncate" title={prompt}>{prompt}</p>
        </div>
    );
};

interface ScriptSections {
    hook: string;
    act1: string;
    act2: string;
    act3: string;
    close: string;
}

const App: React.FC = () => {
    const [theme, setTheme] = useState<string>('');
    const [scriptSections, setScriptSections] = useState<ScriptSections>({
      hook: '',
      act1: '',
      act2: '',
      act3: '',
      close: '',
    });
    const [generatedImages, setGeneratedImages] = useState<{ src: string, prompt: string, section: keyof ScriptSections }[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleScriptChange = (section: keyof ScriptSections, value: string) => {
        setScriptSections(prev => ({ ...prev, [section]: value }));
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);

        const scenesWithSections: { scene: string; section: keyof ScriptSections }[] = [];
        (Object.keys(scriptSections) as Array<keyof ScriptSections>).forEach(sectionKey => {
            scriptSections[sectionKey]
                .split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .forEach(scene => {
                    scenesWithSections.push({ scene, section: sectionKey });
                });
        });
        
        if (scenesWithSections.length === 0) {
             setError('Script is empty or contains only whitespace.');
             setIsLoading(false);
             return;
        }

        try {
            // Process scenes sequentially to build context
            for (let i = 0; i < scenesWithSections.length; i++) {
                const { scene: currentScene, section } = scenesWithSections[i];
                // Context is all the scenes before the current one
                const storyContext = scenesWithSections.slice(0, i).map(s => s.scene).join('\n');

                const base64Image = await generateImageForScene(currentScene, storyContext, theme);

                const newImage = {
                    src: `data:image/png;base64,${base64Image}`,
                    prompt: currentScene,
                    section: section
                };

                // Update state to show images as they are generated
                setGeneratedImages(prevImages => [...prevImages, newImage]);
            }

        } catch (e) {
            console.error(e);
            // FIX: The caught error `e` is of type `unknown`. This provides robust error message extraction.
            let errorMessage = 'An unknown error occurred during image generation.';
            if (typeof e === 'string') {
                errorMessage = e;
            } else if (e instanceof Error) {
                errorMessage = e.message;
            }
            setError(`Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadAll = async () => {
        if (generatedImages.length === 0) return;

        const zip = new JSZip();

        // Helper to convert data URL to blob
        const dataUrlToBlob = (dataUrl: string): Blob | null => {
            const parts = dataUrl.split(',');
            if (parts.length !== 2) return null;

            const mimeMatch = parts[0].match(/:(.*?);/);
            if (!mimeMatch || mimeMatch.length < 2) return null;
            const mime = mimeMatch[1];
            
            try {
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                return new Blob([u8arr], { type: mime });
            } catch (e) {
                console.error("Failed to decode base64 string", e);
                return null;
            }
        };

        const sceneCounters: { [key in keyof ScriptSections]?: number } = {};

        generatedImages.forEach((image, index) => {
            const section = image.section;
            // JSZip creates folder if it doesn't exist, and returns a JSZip object representing the folder
            const folder = zip.folder(section);

            if (!folder) return; // Should not happen with valid section names

            // Increment scene counter for the section to name files correctly within their folders
            sceneCounters[section] = (sceneCounters[section] || 0) + 1;
            const sceneNumberInSection = sceneCounters[section];

            const safePrompt = image.prompt.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `scene_${String(sceneNumberInSection).padStart(2, '0')}_${safePrompt}.png`;
            
            const imageBlob = dataUrlToBlob(image.src);
            if(imageBlob) {
                folder.file(filename, imageBlob);
            }
        });

        const content = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        const safeTheme = (theme.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'storyboard').slice(0, 50);
        link.download = `${safeTheme}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    // FIX: `Object.values()` on an object without an index signature can return `unknown[]` in strict TS mode.
    // We cast to `string[]` which is safe because all values in `ScriptSections` are strings.
    const isScriptEmpty = (Object.values(scriptSections) as string[]).every(section => section.trim() === '');

    const scriptSectionInputs: {key: keyof ScriptSections, title: string, description: string, placeholder: string, rows: number}[] = [
        { key: 'hook', title: 'Hook', description: "The opening scene that grabs the audience's attention.", placeholder: "A lone astronaut stands on a red, dusty planet...", rows: 2},
        { key: 'act1', title: 'Act 1', description: "Introduce the characters and the central conflict.", placeholder: "The astronaut finds a mysterious glowing artifact.", rows: 3 },
        { key: 'act2', title: 'Act 2', description: "The characters face obstacles and challenges.", placeholder: "A sandstorm hits, forcing the astronaut to take shelter.\nThe artifact starts to hum with energy.", rows: 4 },
        { key: 'act3', title: 'Act 3', description: "The climax of the story where the conflict is resolved.", placeholder: "The artifact projects a map into the sky.", rows: 3 },
        { key: 'close', title: 'Close', description: "The final scenes, showing the aftermath.", placeholder: "The astronaut follows the map towards a distant mountain.", rows: 2 },
    ]

    return (
        <div className="bg-gray-900 min-h-screen text-white flex flex-col items-center">
            <Header />
            <main className="container mx-auto p-4 md:p-8 flex-grow w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Left Column: Input */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
                            <div>
                                <h2 className="text-xl font-bold mb-2 text-blue-400">1. Define a Theme (Optional)</h2>
                                <p className="text-sm text-gray-400 mb-2">Describe the overall visual style you want (e.g., 'anime style', 'film noir', 'watercolor painting').</p>
                                <input
                                    type="text"
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    placeholder="e.g., Cyberpunk, dark fantasy, watercolor"
                                    className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    disabled={isLoading}
                                    aria-label="Overall theme"
                                />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold mb-2 text-blue-400">2. Write Your Script</h2>
                                <p className="text-sm text-gray-400 mb-2">Enter your story scene by scene in the sections below. Each line will generate an image.</p>
                                <div className="flex flex-col gap-4">
                                {scriptSectionInputs.map(section => (
                                     <div key={section.key}>
                                        <h3 className="text-lg font-semibold mb-1 text-gray-300">{section.title}</h3>
                                        <p className="text-xs text-gray-500 mb-2">{section.description}</p>
                                        <textarea
                                            value={scriptSections[section.key]}
                                            onChange={(e) => handleScriptChange(section.key, e.target.value)}
                                            placeholder={section.placeholder}
                                            className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            rows={section.rows}
                                            disabled={isLoading}
                                            aria-label={`${section.title} script input`}
                                        />
                                    </div>
                                ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={isScriptEmpty || isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-transform duration-200 transform active:scale-95 text-lg flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Generating...' : 'Generate Storyboard'}
                            {isLoading && <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>}
                        </button>
                         {error && <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md" role="alert">{error}</div>}
                    </div>

                    {/* Right Column: Output */}
                    <div className="flex flex-col bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-blue-400">Storyboard Result</h2>
                             {generatedImages.length > 0 && (
                                <button
                                    onClick={handleDownloadAll}
                                    disabled={isLoading}
                                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"
                                    aria-label="Download all images as a zip file"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                    Download All (.zip)
                                </button>
                            )}
                        </div>
                        <div className="w-full flex-grow rounded-md bg-gray-900/50 p-2 overflow-y-auto min-h-[400px] max-h-[70vh]">
                            {isLoading && generatedImages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                    <Spinner />
                                    <p className="mt-4 text-gray-400">Gemini is creating your storyboard...</p>
                                </div>
                            ) : generatedImages.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {generatedImages.map((image, index) => (
                                      <ImageContainer key={index} src={image.src} alt={`Scene ${index + 1}`} prompt={image.prompt} sceneNumber={index + 1} />
                                  ))}
                                  {isLoading && (
                                     <div className="flex flex-col items-center justify-center h-full bg-gray-900 rounded-lg p-4 sm:col-span-1">
                                        <Spinner />
                                    </div>
                                  )}
                                </div>
                            ) : (
                                <div className="flex flex-col text-center text-gray-500 items-center justify-center h-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="mt-2">Your generated storyboard will appear here</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
