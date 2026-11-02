import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

export type DescriptionStyle =
  | "elegant"
  | "luxurious"
  | "minimal"
  | "detailed"
  | "playful";

export interface GenerateDescriptionPayload {
  name?: string;
  fabric?: string;
  colorTone?: string;
  pattern?: string;
  dimensions?: string;
  threadCount?: string;
  pillowCovers?: string;
  collection?: string;
  features?: string[];
  style?: DescriptionStyle;
  customNotes?: string;
  imageUrl?: string;
}

export interface GenerateDescriptionResponse {
  success: boolean;
  description: string;
  source: "gemini" | "atelier_engine";
  style: string;
  model?: string;
  warnings?: string;
  error?: string;
}

function isKidsProduct(payload: GenerateDescriptionPayload): boolean {
  const text = `${payload.name || ""} ${payload.pattern || ""} ${payload.collection || ""} ${payload.customNotes || ""}`.toLowerCase();

  return (
    payload.style === "playful" ||
    ["kid", "child", "baby", "nursery", "safari", "animal", "dino", "cartoon", "teddy", "cute", "star", "bear", "bunny", "jungle"].some(word => text.includes(word))
  );
}

export function generateAtelierDescription(payload: GenerateDescriptionPayload): string {
  const fabric = payload.fabric?.trim() || "100% Pure Combed Cotton";
  const threadCount = payload.threadCount?.trim() || "350 Thread Count";
  const dimensions = payload.dimensions?.trim() || "108 x 108 inches King";
  const pattern = payload.pattern?.trim() || "Artisanal Motifs";
  const colorTone = payload.colorTone?.trim() || "Cream & Pastel";
  const style = payload.style || (isKidsProduct(payload) ? "playful" : "elegant");
  const isKids = isKidsProduct(payload) || style === "playful";

  const patternLower = pattern.toLowerCase();
  const colorLower = colorTone.toLowerCase().replace(/palette/i, "").trim();

  // Style leading adjective
  const styleAdjMap: Record<string, string> = {
    playful: "A delightful",
    elegant: "An elegant",
    luxurious: "A luxurious",
    minimal: "A crisp, contemporary",
    detailed: "A beautifully detailed"
  };
  const leadAdj = isKids ? "A delightful" : (styleAdjMap[style] || "An elegant");

  // Determine motif arrangement phrasing
  let arrangement = "arranged in a repeating pattern";
  if (isKids || patternLower.includes("animal") || patternLower.includes("cartoon") || patternLower.includes("star") || patternLower.includes("safari") || patternLower.includes("dino")) {
    arrangement = "arranged in a cheerful storybook pattern";
  } else if (patternLower.includes("floral") || patternLower.includes("rose") || patternLower.includes("botanical") || patternLower.includes("vine")) {
    arrangement = "arranged in a graceful trailing floral pattern";
  } else if (patternLower.includes("geometric") || patternLower.includes("stripe") || patternLower.includes("check") || patternLower.includes("trellis")) {
    arrangement = "arranged in a clean repeating grid";
  } else if (patternLower.includes("elephant") || patternLower.includes("jaipuri") || patternLower.includes("booti") || patternLower.includes("ethnic") || patternLower.includes("heritage")) {
    arrangement = "arranged in a repeating pattern";
  }

  // Determine border & pillow accent vibe
  let borderVibe = "add a vibrant, elegant touch to the overall design";
  if (isKids) {
    borderVibe = "add a sweet, playful touch to any child's bedroom";
  } else if (patternLower.includes("elephant") || patternLower.includes("heritage") || patternLower.includes("ethnic") || patternLower.includes("jaipuri")) {
    borderVibe = "add a vibrant, ethnic touch to the overall design";
  } else if (patternLower.includes("floral") || patternLower.includes("rose") || patternLower.includes("botanical")) {
    borderVibe = "add a serene, romantic garden touch to the overall design";
  } else if (patternLower.includes("geometric") || style === "minimal") {
    borderVibe = "add a sophisticated, modern touch to the overall design";
  } else if (style === "luxurious") {
    borderVibe = "add an opulent, regal touch to the overall design";
  }

  // Sentence 1: Base color + Motifs + Arrangement
  const motifTerm = patternLower.includes("motif") || patternLower.includes("print") || patternLower.includes("pattern")
    ? pattern
    : `${pattern} motifs`;
  const sentence1 = `${leadAdj} ${colorLower} bedsheet featuring ${motifTerm} ${arrangement}.`;

  // Sentence 2: Borders & pillow accents
  const sentence2 = `The rich contrasting borders and matching pillow accents ${borderVibe}.`;

  // Sentence 3: Tactile comfort & quality
  const sentence3 = isKids
    ? `Tailored from hypoallergenic, ultra-gentle ${fabric} (${threadCount}) for soft, peaceful nights.`
    : `Tailored from breathable ${fabric} in generous ${dimensions} for everyday luxury and effortless drape.`;

  return `${sentence1} ${sentence2} ${sentence3}`;
}

function normalizeImageMimeType(mimeOrExt: string): string | null {
  const clean = mimeOrExt.toLowerCase().trim();
  if (
    clean === "image/jpeg" ||
    clean === "image/jpg" ||
    clean === "image/pjpeg" ||
    clean === "jpg" ||
    clean === "jpeg"
  ) {
    return "image/jpeg";
  }
  if (
    clean === "image/png" ||
    clean === "image/x-png" ||
    clean === "png"
  ) {
    return "image/png";
  }
  if (clean === "image/webp" || clean === "webp") {
    return "image/webp";
  }
  if (clean === "image/gif" || clean === "gif") {
    return "image/gif";
  }
  return null;
}

async function resolveImageInput(
  imageUrl?: string
): Promise<{ mimeType: string; data: string } | null> {
  if (!imageUrl || typeof imageUrl !== "string") return null;

  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  const maxBytes = 3 * 1024 * 1024; // 3MB limit

  try {
    // 1. Base64 Data URL (e.g. data:image/jpeg;base64,...)
    if (trimmed.startsWith("data:")) {
      const match = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const rawSubtype = match[1].toLowerCase();
        const mimeType =
          normalizeImageMimeType(`image/${rawSubtype}`) ||
          normalizeImageMimeType(rawSubtype);

        if (!mimeType) {
          console.warn("Unrecognized image data URL format:", rawSubtype);
          return null;
        }

        const base64Data = match[2];
        if (Buffer.byteLength(base64Data, "base64") > maxBytes) {
          console.warn("Data URL image exceeds 3MB limit, continuing without image");
          return null;
        }

        return { mimeType, data: base64Data };
      }
      return null;
    }

    // 2. Local relative path (e.g. /images/... or /uploads/... or images/...)
    if (trimmed.startsWith("/") || !trimmed.startsWith("http")) {
      const cleanRelative = trimmed.replace(/^\//, "");
      const candidatePaths = [
        path.join(process.cwd(), "public", cleanRelative),
        path.join(process.cwd(), cleanRelative),
        path.join(__dirname, "public", cleanRelative),
        path.join(__dirname, "..", "public", cleanRelative),
      ];

      for (const filePath of candidatePaths) {
        try {
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
            const mimeType = normalizeImageMimeType(ext);
            if (mimeType) {
              const fileBuffer = await fs.promises.readFile(filePath);
              if (fileBuffer.byteLength <= maxBytes) {
                return {
                  mimeType,
                  data: fileBuffer.toString("base64")
                };
              }
            }
          }
        } catch {
          // Continue to next candidate
        }
      }
      return null;
    }

    // 3. Remote URL (http / https)
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          Accept: "image/webp,image/jpeg,image/png,image/*;q=0.8"
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Remote image returned HTTP ${response.status}`);
        return null;
      }

      const rawContentType = (response.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

      let mimeType = normalizeImageMimeType(rawContentType);
      if (!mimeType) {
        const ext = path.extname(parsed.pathname).replace(/^\./, "").toLowerCase();
        mimeType = normalizeImageMimeType(ext);
      }

      if (!mimeType) {
        console.warn(`Unsupported image content-type: "${rawContentType}", continuing without image vision`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.byteLength > maxBytes) {
        console.warn("Fetched image exceeds 3MB limit, continuing without image vision");
        return null;
      }

      return {
        mimeType,
        data: buffer.toString("base64")
      };
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.warn("Could not fetch remote image for AI vision:", fetchErr?.message || fetchErr);
      return null;
    }
  } catch (err: any) {
    console.warn("Image resolving notice:", err?.message || err);
    return null;
  }
}

export async function generateProductDescription(
  payload: GenerateDescriptionPayload
): Promise<GenerateDescriptionResponse> {
  const isKids = isKidsProduct(payload);
  const style = payload.style || (isKids ? "playful" : "elegant");
  const apiKey = process.env.GEMINI_API_KEY;

  // Updated Gemini model configuration
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const name = payload.name?.trim() || "Cotton Nest Bedsheet";

  const styleGuides: Record<string, string> = {
    playful: "Cheerful, whimsical and joyful. Vividly describe the cute print, friendly characters/animals, playful patterns, and gentle hypoallergenic softness on sensitive young skin.",
    elegant: "Graceful, calming, poetic and premium, highlighting serene motifs and peaceful bedroom ambience.",
    luxurious: "Refined, sophisticated and opulent, highlighting rich motif placement and royal Indian heritage.",
    minimal: "Crisp, contemporary and understated, highlighting clean lines and essential pure cotton comfort.",
    detailed: "Informative, descriptive and clear, highlighting weave, print symmetry, tuck-in drop, and matching pillow shams."
  };

  const systemInstruction = `
You are a master textile visual copywriter for Cotton Nest, a luxury 100% pure cotton bedding brand in India.

PRIMARY OBJECTIVE:
Generate an evocative, visually grounded product description describing what the bedsheet looks like in the image and design specifications. Focus directly on the base colour, focal motifs, pattern arrangement, border details, and coordinated pillow accents.

GOLD STANDARD TARGET STYLE:
"An elegant cream bedsheet featuring colourful traditional elephant motifs arranged in a repeating pattern. The rich red borders and matching pillow accents add a vibrant, ethnic touch to the overall design."

WRITING GUIDELINES:
1. Sentence 1 (Visual Motifs & Layout):
   Describe the base colour and focal motifs/illustrations, explicitly mentioning their arrangement (e.g. "arranged in a repeating pattern", "arranged in a graceful trailing floral pattern", "scattered across a playful storybook layout", "arranged in a clean geometric grid").
2. Sentence 2 (Borders & Pillow Accents):
   Describe the border styling (e.g. rich contrast borders, tailored piping) and matching pillow accents, explaining the aesthetic vibe they bring to the bedroom (e.g. "add a vibrant, ethnic touch to the overall design", "add a serene, romantic garden touch", "add a sweet, playful touch to any child's bedroom").
3. Sentence 3 (Tactile & Craft touch):
   Conclude with a brief note on breathable pure cotton comfort, soft hand-feel, or generous proportions.
4. Total Length: Exactly 2 to 3 sentences (concise, visual, captivating, approximately 45-75 words).
5. Never write generic filler or corporate jargon. Describe the bedsheet's real visual artwork like the gold standard example.

Return ONLY the final description text.
`;

  const userPrompt = `
Generate a visual-first product description for this Cotton Nest bedsheet:

Product Name: ${name}
Base Colour / Palette: ${payload.colorTone || "Not specified"}
Artwork / Pattern Motifs: ${payload.pattern || "Not specified"}
Theme / Collection: ${payload.collection || "Not specified"}
Fabric: ${payload.fabric || "100% Pure Combed Cotton"}
Thread Count: ${payload.threadCount || "Not specified"}
Dimensions: ${payload.dimensions || "Not specified"}
Pillow Covers: ${payload.pillowCovers || "Not specified"}
Desired Style Tone: ${styleGuides[style] || styleGuides.elegant}
${isKids || style === 'playful' ? 'Note: This is a kids/nursery bedsheet. Spotlight the cute print, friendly characters, and whimsical bedtime charm!' : ''}
${payload.customNotes ? `Owner Notes: ${payload.customNotes}` : ''}

Target Style Exemplar:
"An elegant cream bedsheet featuring colourful traditional elephant motifs arranged in a repeating pattern. The rich red borders and matching pillow accents add a vibrant, ethnic touch to the overall design."

Write the description now:
`;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const imageInput = await resolveImageInput(payload.imageUrl);

      const parts: any[] = [{ text: userPrompt }];

      if (imageInput) {
        parts.unshift({
          inlineData: {
            mimeType: imageInput.mimeType,
            data: imageInput.data
          }
        });
      }

      const geminiPromise = ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts
          }
        ],
        config: {
          systemInstruction,
          temperature: 0.75
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Gemini generation timed out after 7s")), 7000);
      });

      const response = await Promise.race([geminiPromise, timeoutPromise]);

      const generatedText = response.text?.trim() || "";

      if (generatedText.length > 20) {
        return {
          success: true,
          description: generatedText,
          source: "gemini",
          style,
          model
        };
      }

      console.warn("Gemini returned short description, using atelier engine fallback");
    } catch (error: any) {
      console.warn("Gemini generation notice, falling back to Cotton Nest Atelier engine:", error?.message || error);

      return {
        success: true,
        description: generateAtelierDescription(payload),
        source: "atelier_engine",
        style,
        warnings: `Generated with Cotton Nest Atelier copywriter (${error?.message || "Gemini notice"}).`
      };
    }
  }

  return {
    success: true,
    description: generateAtelierDescription(payload),
    source: "atelier_engine",
    style,
    warnings: "Generated with Cotton Nest Atelier copywriter."
  };
}