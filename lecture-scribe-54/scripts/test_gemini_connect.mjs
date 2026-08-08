import { GoogleGenAI } from '@google/genai'

async function main(){
  const key = process.env.GEMINI_API_KEY
  if(!key){
    console.error('NO_KEY')
    process.exit(2)
  }
  try{
    const ai = new GoogleGenAI({ apiKey: key })
    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: 'Connectivity test' }] }],
      config: { maxOutputTokens: 10 }
    })
    const text = res?.text ?? ''
    console.log('GEMINI_OK','LENGTH=' + text.length)
  }catch(e){
    // print safe diagnostics
    try{
      if(e?.status) console.log('ERR_STATUS=' + e.status)
      if(e?.response?.status) console.log('RESP_STATUS=' + e.response.status)
      if(e?.response?.data) {
        // redact any API key-like substrings
        const s = JSON.stringify(e.response.data).replace(/[A-Za-z0-9\-_.]{20,}/g, '[REDACTED]')
        console.log('RESP_DATA=' + s)
      }
      if(e?.message) console.log('ERR_MESSAGE=' + e.message)
    }catch(_){
      console.log('ERR_UNKNOWN')
    }
    process.exit(3)
  }
}

main()
