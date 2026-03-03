
import { GoogleGenAI, Type } from "@google/genai";
import { BanquetObject, ObjectType } from "../types";

const API_KEY = process.env.API_KEY || '';

export const generateLayout = async (
  width: number,
  length: number,
  description: string
): Promise<Partial<BanquetObject>[]> => {
  if (!API_KEY) {
    console.warn("No API Key found");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `
    I have a banquet hall with dimensions Width: ${width} meters and Length: ${length} meters.
    Generate a layout for the following request: "${description}".
    
    Return a JSON array of objects to place in the room.
    Coordinate system: Center of room is (0,0). X ranges from -${width/2} to ${width/2}. Z ranges from -${length/2} to ${length/2}. Y is usually 0 for floor objects.
    
    Use these specific Object Types:
    - ROUND_TABLE (Radius approx 1.5m)
    - RECT_TABLE (Size approx 2x1m)
    - STAGE (Usually at one end)
    
    - SPEAKER_15 (Standard 15" PA speaker on stand)
    - SPEAKER_MONITOR (Floor wedge monitor, place on stage)
    - SPEAKER_SUB (Subwoofer, usually on floor near stage)
    - SPEAKER_COLUMN (Slim column array)
    
    - LIGHT_PAR (LED Par wash light)
    - LIGHT_MOVING (Moving head beam/spot light)
    
    Provide sensible positions (x, z) and rotations (y).
    For monitors, place them on the STAGE area facing inwards/backwards.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: Object.values(ObjectType) },
              x: { type: Type.NUMBER },
              z: { type: Type.NUMBER },
              rotY: { type: Type.NUMBER, description: "Rotation in radians around Y axis" },
              label: { type: Type.STRING }
            },
            required: ["type", "x", "z"]
          }
        }
      }
    });

    const rawData = JSON.parse(response.text || "[]");
    
    // Transform to our app's format
    return rawData.map((item: any) => ({
      type: item.type as ObjectType,
      position: { x: item.x, y: 0, z: item.z },
      rotation: { x: 0, y: item.rotY || 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      label: item.label || ''
    }));

  } catch (error) {
    console.error("Gemini generation failed:", error);
    throw error;
  }
};
