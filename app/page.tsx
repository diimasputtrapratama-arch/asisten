import {currentUser} from "@/lib/auth";import {db} from "@/lib/db";import Client from "@/components/client";
export default async function Page(){const u=await currentUser();const a=await db.assistant.findMany({where:{enabled:true},orderBy:{createdAt:"asc"}});return <Client user={u?{id:u.id,email:u.email,role:u.role,profile:u.profile}:null} assistants={a}/> }
