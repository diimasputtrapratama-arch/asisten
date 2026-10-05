import {cookies} from "next/headers"; import crypto from "crypto"; import {db} from "./db";
export const hashToken=(v:string)=>crypto.createHash("sha256").update(v).digest("hex");
export async function currentUser(){
 const t=(await cookies()).get("putra_session")?.value;if(!t)return null;
 const s=await db.session.findUnique({where:{tokenHash:hashToken(t)},include:{user:{include:{profile:true}}}});
 if(!s||s.expiresAt<new Date()||s.user.disabled)return null; return s.user;
}
export async function requireAdmin(){const u=await currentUser();if(!u||u.role!=="ADMIN")throw new Error("FORBIDDEN");return u;}