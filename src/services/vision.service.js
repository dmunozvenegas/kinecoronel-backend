const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const extractAgendaData = async (imageBuffer, mimeType) => {
    
    // Mantenemos el modelo 3.5 que ya comprobamos que te funciona perfecto
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3.5-flash-lite",
        generationConfig: {
            responseMimeType: "application/json", 
        }
    });

    // NUEVO PROMPT: Le agregamos una regla extra sobre la sintaxis JSON
    const prompt = `
    Analiza esta imagen que corresponde a un "Bono de Atención de Salud" (Fonasa).
    Tu objetivo es extraer los datos clave para un registro administrativo y financiero.
    
    Devuelve los datos ESTRICTAMENTE en este formato JSON, dentro de un arreglo:
    [
      {
        "rut_beneficiario": "Extraer el dato del campo 'RUT PERSONA BENEFICIARIA'",
        "fecha_emision": "Extraer el dato del campo 'FECHA EMISION'", 
        "numero_bono": "Extraer el número que aparece junto a 'N°'",
        "monto": "Extraer el valor total o copago del bono. DEBE SER UN NÚMERO (ej: 14420). Quita puntos, comas y signos $."
      }
    ]
    Reglas:
    1. El RUT debe mantener su formato original (ejemplo: 6153279-K).
    2. El monto debe ser un número entero. Si no logras leerlo, devuelve 0.
    3. Si no logras leer texto, devuelve "".
    4. REVISA TU SINTAXIS: No agregues llaves "}" ni comas "," adicionales al final del arreglo.
    5. DEVUELVE ÚNICAMENTE EL ARREGLO JSON.
    `;

    const imagePart = {
        inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: mimeType
        }
    };

    try {
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        
        let textoCrudo = response.text();
        
        // 1. Limpiamos las etiquetas Markdown de código
        textoCrudo = textoCrudo.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        // 2. FILTRO DE PINZAS: Extraemos solo el arreglo JSON
        const inicioArray = textoCrudo.indexOf('[');
        const finArray = textoCrudo.lastIndexOf(']');
        
        if (inicioArray !== -1 && finArray !== -1) {
            textoCrudo = textoCrudo.substring(inicioArray, finArray + 1);
        }
        
        // 3. Parseamos de forma segura
        try {
            return JSON.parse(textoCrudo);
        } catch (error) {
            console.error("Error en Vision API procesando el Bono:", error);
            
            // 👇 Interceptamos la caída de servidores de Google
            if (error.status === 503 || error.message.includes("503")) {
                throw new Error("Los servidores de Inteligencia Artificial están temporalmente saturados. Por favor, espera 1 minuto e intenta de nuevo.");
            }
            
            throw new Error("El modelo de IA devolvió un error. Intenta escanear nuevamente.");
        }
        
    } catch (error) {
        console.error("Error en Vision API procesando el Bono:", error);
        throw error;
    }
};

module.exports = { extractAgendaData };