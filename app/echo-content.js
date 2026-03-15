const sendToAI = async (blob) => {
    setStatus('thinking');
    try {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      formData.append("model", "whisper-large-v3");
      
      const tRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST", headers: { "Authorization": `Bearer ${apiKey}` }, body: formData
      });
      const tData = await tRes.json();
      
      const cRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.3, // Снижаем температуру для стабильности
          messages: [
            { 
              role: "system", 
              content: "You are the ECHO neural interface. Analyze user input and respond in the SAME language as the user. " +
                       "CRITICAL RULES: \n" +
                       "1. Your response must be in TWO parts separated by the symbol '|||'. \n" +
                       "2. Part 1: Deep strategic analysis (25 words max). \n" +
                       "3. Part 2: Immediate tactical directive (15 words max). \n" +
                       "4. DO NOT use words like 'Analysis' or 'Directive' in the text. \n" +
                       "5. Be cold, sharp, and highly intelligent."
            }, 
            { role: "user", content: tData.text }
          ]
        })
      });
      
      const cData = await cRes.json();
      const aiResponse = cData.choices[0].message.content;
      
      // Самый надежный способ разделения по маркеру |||
      const parts = aiResponse.split('|||');
      const essence = parts[0]?.trim() || "Analysis synchronization failed.";
      const action = parts[1]?.trim() || "Execute standard protocol.";
      
      setResult({ essence, action });
      setStatus('done');
      speak(action);
      
    } catch (err) { 
      setError("Sync Error: Link Unstable"); 
      setStatus('ready'); 
    }
  };
