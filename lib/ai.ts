import type {ChatMessage} from "./types";
export type ChatMessage={role:"user"|"assistant"|"system";content:string};
async function gemini(messages:ChatMessage[],model:string,system:string){
 const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("GEMINI_API_KEY belum diset");
 const contents=messages.filter(x=>x.role!=="system").map(x=>({role:x.role==="assistant"?"model":"user",parts:[{text:x.content}]}));
 return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:.7}})});
}
async function groq(messages:ChatMessage[],model:string,system:string){
 const key=process.env.GROQ_API_KEY;if(!key)throw new Error("GROQ_API_KEY belum diset");
 return fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:system},...messages],temperature:.7,stream:true})});
}
export async function providerStream(provider:string,messages:ChatMessage[],model:string,system:string){
 const primary=provider==="groq"?groq:gemini;const fallback=provider==="groq"?gemini:groq;
 try{const r=await primary(messages,model,system);if(r.ok)return r}catch{}
 const r=await fallback(messages,model,system);if(!r.ok)throw new Error(await r.text());return r;
}
export function normalizeStream(provider:string,up:ReadableStream<Uint8Array>){
 const rd=up.getReader(),dec=new TextDecoder(),enc=new TextEncoder();let buf="";
 return new ReadableStream<Uint8Array>({async pull(c){const {done,value}=await rd.read();if(done){c.close();return}buf+=dec.decode(value,{stream:true});const lines=buf.split("\\n");buf=lines.pop()||"";for(const line of lines){if(!line.startsWith("data:"))continue;const d=line.slice(5).trim();if(!d||d==="[DONE]")continue;try{const j=JSON.parse(d);const t=provider==="groq"?j.choices?.[0]?.delta?.content||"":j.candidates?.[0]?.content?.parts?.[0]?.text||"";if(t)c.enqueue(enc.encode(t))}catch{}}},cancel(){rd.cancel()}})}
