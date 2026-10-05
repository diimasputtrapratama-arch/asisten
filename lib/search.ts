export async function searchWeb(query:string){
 const key=process.env.TAVILY_API_KEY;if(!key)return [];
 const r=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:key,query,max_results:5,search_depth:"basic"})});
 if(!r.ok)return []; const d=await r.json();return d.results||[];
}