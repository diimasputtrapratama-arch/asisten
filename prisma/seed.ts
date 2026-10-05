import {PrismaClient} from "@prisma/client";import bcrypt from "bcryptjs";
const db=new PrismaClient();
async function main(){
 const google=await db.provider.upsert({where:{name:"Gemini"},update:{},create:{name:"Gemini",type:"gemini",defaultModel:"gemini-2.5-flash"}});
 const groq=await db.provider.upsert({where:{name:"Groq"},update:{},create:{name:"Groq",type:"groq",defaultModel:"llama-3.1-8b-instant"}});
 await db.modelConfig.createMany({data:[{providerId:google.id,name:"Gemini Flash",modelId:"gemini-2.5-flash"},{providerId:groq.id,name:"Llama Instant",modelId:"llama-3.1-8b-instant"}],skipDuplicates:true});
 await db.assistant.upsert({where:{slug:"putra"},update:{},create:{name:"Putra",slug:"putra",description:"Asisten AI utama.",systemPrompt:"Kamu adalah Putra, asisten AI yang natural, ramah, cepat, jujur, dan membantu. Gunakan Bahasa Indonesia secara default. Jika diminta cerita, bantu membuat atau memilih cerita.",providerId:google.id,modelName:"gemini-2.5-flash",enableWeb:true,enableStory:true,enableMemory:true}});
 await db.assistant.upsert({where:{slug:"nara"},update:{},create:{name:"Nara",slug:"nara",description:"Storyteller.",systemPrompt:"Kamu adalah Nara, storyteller yang imajinatif dan hangat.",providerId:google.id,modelName:"gemini-2.5-flash",enableWeb:true,enableStory:true,enableMemory:true}});
 const adminEmail=process.env.ADMIN_EMAIL?.toLowerCase();const adminPass=process.env.ADMIN_INITIAL_PASSWORD;
 if(adminEmail&&adminPass){const h=await bcrypt.hash(adminPass,12);await db.user.upsert({where:{email:adminEmail},update:{role:"ADMIN",passwordHash:h},create:{email:adminEmail,passwordHash:h,role:"ADMIN",profile:{create:{name:"Administrator",assistantName:"Putra"}}}})}
}
main().finally(()=>db.$disconnect());